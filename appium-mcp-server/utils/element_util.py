# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import xml.etree.ElementTree as ET


def is_element_visible(element):
    """Check if element is visible based on its attributes"""
    # Always include root hierarchy element
    if element.tag == "hierarchy":
        return True
    
    # Basic visibility checks
    if element.attrib.get("visible") == "false":
        return False
    
    if element.attrib.get("displayed") == "false":
        return False
    
    # Check width and height attributes directly
    width = element.attrib.get("width", "")
    height = element.attrib.get("height", "")
    
    if width == "0" or height == "0":
        return False
    
    return True


def filter_visible_elements(root):
    """Filter XML tree to keep only visible elements"""
    def filter_tree(element):
        """Recursively filter the tree to keep only visible elements"""
        # Always keep root element
        if element.tag == "hierarchy":
            new_element = ET.Element(element.tag, element.attrib)
            new_element.text = element.text
            new_element.tail = element.tail
            
            # Process children
            for child in element:
                filtered_child = filter_tree(child)
                if filtered_child is not None:
                    new_element.append(filtered_child)
            
            return new_element
        
        # For other elements, check if they or their children are visible
        element_is_visible = is_element_visible(element)
        
        # Recursively process children first
        visible_children = []
        for child in element:
            filtered_child = filter_tree(child)
            if filtered_child is not None:
                visible_children.append(filtered_child)
        
        # Keep element if:
        # 1. The element itself is visible, OR
        # 2. It has visible children (even if parent has size 0)
        if element_is_visible or visible_children:
            new_element = ET.Element(element.tag, element.attrib)
            new_element.text = element.text
            new_element.tail = element.tail
            
            # Add all visible children
            for child in visible_children:
                new_element.append(child)
            
            return new_element
        
        # Filter out this element (not visible and no visible children)
        return None
    
    return filter_tree(root)


def extract_element_info(element):
    info = {
        "title": element.window_text(),
        "control_type": element.element_info.control_type,
        "automation_id": element.element_info.automation_id,
        "class_name": element.element_info.class_name,
        "rectangle": {
            "left": element.rectangle().left,
            "top": element.rectangle().top,
            "right": element.rectangle().right,
            "bottom": element.rectangle().bottom,
        },
        "children": [],
    }
    if (
        element.element_info.automation_id == "RootWebArea"
        and element.element_info.control_type == "Document"
        and element.window_text() not in ["Favorites", "Downloads", "History"]
    ):
        return info

    for child in element.children():
        info["children"].append(extract_element_info(child))
    return info


def simplify_page_source(page_source: str, max_size: int = 200000) -> str:
    """Simplify page source if it's too large by keeping only essential elements"""
    if len(page_source) <= max_size:
        return page_source

    try:
        # Parse XML
        root = ET.fromstring(page_source)

        # Strategy 1: Filter out invisible elements first
        root = filter_visible_elements(root)
        if root is None:
            return "<hierarchy><summary>No visible elements found</summary></hierarchy>"
        
        simplified = ET.tostring(root, encoding="unicode")
        if len(simplified) <= max_size:
            return simplified

        # Strategy 2: Truncate long text values
        for elem in root.iter():
            if "text" in elem.attrib and len(elem.attrib["text"]) > 100:
                elem.attrib["text"] = elem.attrib["text"][:97] + "..."
            if "content-desc" in elem.attrib and len(elem.attrib["content-desc"]) > 100:
                elem.attrib["content-desc"] = elem.attrib["content-desc"][:97] + "..."

        simplified = ET.tostring(root, encoding="unicode")
        if len(simplified) <= max_size:
            return simplified

        # Strategy 3: Keep only interactive/meaningful elements
        important_elements = []
        for elem in root.iter():
            if (
                elem.attrib.get("clickable") == "true"
                or elem.attrib.get("enabled") == "true"
                or elem.attrib.get("focusable") == "true"
                or elem.attrib.get("text")
                or elem.attrib.get("content-desc")
                or "edit" in elem.attrib.get("class", "").lower()
                or "button" in elem.attrib.get("class", "").lower()
                or "text" in elem.attrib.get("class", "").lower()
            ):
                important_elements.append(elem)

        # Iteratively reduce elements until size is acceptable
        element_limit = min(len(important_elements), 70)

        while element_limit > 0:
            new_root = ET.Element("hierarchy")
            for elem in important_elements[:element_limit]:
                # Create a copy of the element with essential attributes only
                new_elem = ET.Element(elem.tag)

                # Keep all attributes but truncate long text values
                for attr, value in elem.attrib.items():
                    # Only truncate text and content-desc if they're very long
                    if attr in ["text", "content-desc"] and len(value) > 50:
                        value = value[:47] + "..."
                    new_elem.set(attr, value)

                new_root.append(new_elem)

            simplified = ET.tostring(new_root, encoding="unicode")

            # Check if size is acceptable
            if len(simplified) <= max_size:
                return simplified

            # Reduce element count and try again
            element_limit = int(element_limit * 0.7)

        # Strategy 4: If still too large, create minimal structure
        new_root = ET.Element("hierarchy")
        summary_elem = ET.Element("summary")
        summary_elem.set(
            "message", f"Page simplified - original size: {len(page_source)} chars"
        )
        summary_elem.set("interactive_elements", str(len(important_elements)))
        new_root.append(summary_elem)

        # Add first few most important elements with minimal info
        for i, elem in enumerate(important_elements[:10]):
            simple_elem = ET.Element(f"element_{i}")
            simple_elem.set("class", elem.attrib.get("class", "unknown")[:20])
            if elem.attrib.get("text"):
                simple_elem.set("text", elem.attrib["text"][:30] + "...")
            if elem.attrib.get("content-desc"):
                simple_elem.set("desc", elem.attrib["content-desc"][:30] + "...")
            if elem.attrib.get("clickable") == "true":
                simple_elem.set("clickable", "true")
            new_root.append(simple_elem)

        simplified = ET.tostring(new_root, encoding="unicode")

        # Final fallback: ensure we never exceed max_size
        if len(simplified) > max_size:
            simplified = simplified[: max_size - 15] + "...[truncated]"

        return simplified

    except ET.ParseError:
        # If XML parsing fails, return truncated string with safety margin
        truncated = page_source[: max_size - 15] + "...[truncated]"
        return truncated
