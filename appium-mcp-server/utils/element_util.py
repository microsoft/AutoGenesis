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


def _remove_empty_containers(elem):
    """Remove XCUIElementTypeOther/Group nodes that have no label/identifier/title.
    Their children are promoted to the parent, preserving the meaningful hierarchy."""
    new_children = []
    for child in elem:
        tag = child.tag
        label = child.attrib.get("label", "")
        identifier = child.attrib.get("identifier", "")
        title = child.attrib.get("title", "")

        is_empty_container = (
            tag in ("XCUIElementTypeOther", "XCUIElementTypeGroup")
            and not label
            and not identifier
            and not title
        )

        if is_empty_container:
            # Skip this node, promote its children
            for grandchild in child:
                processed = _remove_empty_containers(grandchild)
                if processed is not None:
                    new_children.append(processed)
        else:
            processed = _remove_empty_containers(child)
            if processed is not None:
                new_children.append(processed)

    new_elem = ET.Element(elem.tag, elem.attrib)
    for c in new_children:
        new_elem.append(c)
    return new_elem


def _remove_collapsed_menus(elem):
    """Remove XCUIElementTypeMenu and XCUIElementTypeMenuItem nodes that are
    NOT visible.  Expanded (visible) menus are preserved."""
    new_children = []
    for child in elem:
        if child.tag in ("XCUIElementTypeMenu", "XCUIElementTypeMenuItem") and not is_element_visible(child):
            continue
        processed = _remove_collapsed_menus(child)
        new_children.append(processed)

    new_elem = ET.Element(elem.tag, elem.attrib)
    for c in new_children:
        new_elem.append(c)
    return new_elem


# Attributes worth keeping for UI understanding and element location
_KEEP_ATTRS = {
    "identifier", "label", "title", "value", "placeholderValue",
    "enabled", "selected",
    "x", "y", "width", "height",
    "elementType",
    # Android attributes
    "text", "content-desc", "resource-id", "class",
    "clickable", "focusable", "scrollable", "checkable", "checked",
    "bounds",
}

# Attribute values that are defaults and can be omitted to save space
_DEFAULT_SKIP = {
    ("enabled", "true"),
    ("selected", "false"),
    ("clickable", "false"),
    ("focusable", "false"),
    ("scrollable", "false"),
    ("checkable", "false"),
    ("checked", "false"),
}


def _strip_attributes(elem):
    """Keep only meaningful attributes and drop default values."""
    new_attrib = {}
    for k, v in elem.attrib.items():
        if k not in _KEEP_ATTRS:
            continue
        if (k, v) in _DEFAULT_SKIP:
            continue
        if k in ("label", "title", "identifier", "value", "placeholderValue",
                 "text", "content-desc", "resource-id") and not v:
            continue
        new_attrib[k] = v

    new_elem = ET.Element(elem.tag, new_attrib)
    for child in elem:
        new_elem.append(_strip_attributes(child))
    return new_elem


def simplify_page_source(page_source: str, max_size: int = 60000) -> str:
    """Simplify page source to fit within max_size while preserving hierarchy.

    Pipeline order (progressive, each stage checks size before proceeding):
      0. Size check — return as-is if already small enough
      1. Filter invisible elements
      2. Truncate long text values (cheap, can save space early)
      3. Remove collapsed menus (invisible Menu/MenuItem — ~30% savings on macOS)
      4. Remove empty containers (Other/Group with no info — promotes children)
      5. Strip redundant attributes (keep only useful ones, drop defaults)
      *. Hard truncation as final fallback
    """
    # --- Stage 0: Size check ---
    if len(page_source) <= max_size:
        return page_source

    try:
        root = ET.fromstring(page_source)
    except ET.ParseError:
        return page_source[:max_size - 15] + "...[truncated]"

    # --- Stage 1: Filter invisible elements ---
    root = filter_visible_elements(root)
    if root is None:
        return "<hierarchy><summary>No visible elements found</summary></hierarchy>"

    result = ET.tostring(root, encoding="unicode")
    if len(result) <= max_size:
        return result

    # --- Stage 2: Truncate long text values ---
    for elem in root.iter():
        for attr in ("text", "content-desc", "label", "value", "title"):
            val = elem.attrib.get(attr, "")
            if len(val) > 80:
                elem.attrib[attr] = val[:77] + "..."

    result = ET.tostring(root, encoding="unicode")
    if len(result) <= max_size:
        return result

    # --- Stage 3: Remove collapsed menu items ---
    root = _remove_collapsed_menus(root)
    result = ET.tostring(root, encoding="unicode")
    if len(result) <= max_size:
        return result

    # --- Stage 4: Remove empty containers (promotes children) ---
    root = _remove_empty_containers(root)
    result = ET.tostring(root, encoding="unicode")
    if len(result) <= max_size:
        return result

    # --- Stage 5: Strip redundant attributes ---
    root = _strip_attributes(root)
    result = ET.tostring(root, encoding="unicode")
    if len(result) <= max_size:
        return result

    # --- Final fallback: hard truncation ---
    return result[:max_size - 15] + "...[truncated]"
