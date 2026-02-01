"""
Element utilities for Mobile Skill.
Provides helper functions for element location and page source manipulation.
"""

import xml.etree.ElementTree as ET
from typing import Optional, Tuple

from appium.webdriver.common.appiumby import AppiumBy


def get_appium_locator(
    locator_strategy_str: str,
    locator_value: str
) -> Tuple[str, str]:
    """
    Convert string locator strategy to AppiumBy locator tuple.

    Args:
        locator_strategy_str: Strategy string (e.g., 'ACCESSIBILITY_ID', 'XPATH')
        locator_value: The locator value

    Returns:
        Tuple of (AppiumBy strategy, locator value)
    """
    strategy_mapping = {
        "": AppiumBy.ACCESSIBILITY_ID,
        "AppiumBy.ACCESSIBILITY_ID": AppiumBy.ACCESSIBILITY_ID,
        "AppiumBy.NAME": AppiumBy.NAME,
        "AppiumBy.ID": AppiumBy.ID,
        "AppiumBy.CLASS_NAME": AppiumBy.CLASS_NAME,
        "AppiumBy.XPATH": AppiumBy.XPATH,
        "AppiumBy.IOS_PREDICATE": AppiumBy.IOS_PREDICATE,
        "AppiumBy.IOS_CLASS_CHAIN": AppiumBy.IOS_CLASS_CHAIN,
        "AppiumBy.ANDROID_UIAUTOMATOR": AppiumBy.ANDROID_UIAUTOMATOR,
        "AppiumBy.ANDROID_VIEWTAG": AppiumBy.ANDROID_VIEWTAG,
        "ACCESSIBILITY_ID": AppiumBy.ACCESSIBILITY_ID,
        "NAME": AppiumBy.NAME,
        "ID": AppiumBy.ID,
        "CLASS_NAME": AppiumBy.CLASS_NAME,
        "XPATH": AppiumBy.XPATH,
        "IOS_PREDICATE": AppiumBy.IOS_PREDICATE,
        "IOS_CLASS_CHAIN": AppiumBy.IOS_CLASS_CHAIN,
        "ANDROID_UIAUTOMATOR": AppiumBy.ANDROID_UIAUTOMATOR,
        "ANDROID_VIEWTAG": AppiumBy.ANDROID_VIEWTAG,
    }

    locator_strategy_str = locator_strategy_str.strip() if locator_strategy_str else ""
    appium_by = strategy_mapping.get(locator_strategy_str, AppiumBy.ACCESSIBILITY_ID)

    return (appium_by, locator_value)


def is_element_visible(element: ET.Element) -> bool:
    """
    Check if element is visible based on its attributes.

    Args:
        element: XML element to check

    Returns:
        True if element is visible
    """
    if element.tag == "hierarchy":
        return True

    if element.attrib.get("visible") == "false":
        return False

    if element.attrib.get("displayed") == "false":
        return False

    width = element.attrib.get("width", "")
    height = element.attrib.get("height", "")

    if width == "0" or height == "0":
        return False

    return True


def filter_visible_elements(root: ET.Element) -> Optional[ET.Element]:
    """
    Filter XML tree to keep only visible elements.

    Args:
        root: Root element of the XML tree

    Returns:
        Filtered tree with only visible elements
    """

    def filter_tree(element: ET.Element) -> Optional[ET.Element]:
        """Recursively filter the tree to keep only visible elements."""
        if element.tag == "hierarchy":
            new_element = ET.Element(element.tag, element.attrib)
            new_element.text = element.text
            new_element.tail = element.tail

            for child in element:
                filtered_child = filter_tree(child)
                if filtered_child is not None:
                    new_element.append(filtered_child)

            return new_element

        element_is_visible = is_element_visible(element)

        visible_children = []
        for child in element:
            filtered_child = filter_tree(child)
            if filtered_child is not None:
                visible_children.append(filtered_child)

        if element_is_visible or visible_children:
            new_element = ET.Element(element.tag, element.attrib)
            new_element.text = element.text
            new_element.tail = element.tail

            for child in visible_children:
                new_element.append(child)

            return new_element

        return None

    return filter_tree(root)


def simplify_page_source(page_source: str, max_size: int = 200000) -> str:
    """
    Simplify page source if it's too large by keeping only essential elements.

    Args:
        page_source: The raw page source XML
        max_size: Maximum allowed size in characters

    Returns:
        Simplified page source string
    """
    if len(page_source) <= max_size:
        return page_source

    try:
        root = ET.fromstring(page_source)

        # Strategy 1: Filter out invisible elements
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

        element_limit = min(len(important_elements), 70)

        while element_limit > 0:
            new_root = ET.Element("hierarchy")
            for elem in important_elements[:element_limit]:
                new_elem = ET.Element(elem.tag)

                for attr, value in elem.attrib.items():
                    if attr in ["text", "content-desc"] and len(value) > 50:
                        value = value[:47] + "..."
                    new_elem.set(attr, value)

                new_root.append(new_elem)

            simplified = ET.tostring(new_root, encoding="unicode")

            if len(simplified) <= max_size:
                return simplified

            element_limit = int(element_limit * 0.7)

        # Strategy 4: Create minimal structure
        new_root = ET.Element("hierarchy")
        summary_elem = ET.Element("summary")
        summary_elem.set(
            "message", f"Page simplified - original size: {len(page_source)} chars"
        )
        summary_elem.set("interactive_elements", str(len(important_elements)))
        new_root.append(summary_elem)

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

        if len(simplified) > max_size:
            simplified = simplified[: max_size - 15] + "...[truncated]"

        return simplified

    except ET.ParseError:
        truncated = page_source[: max_size - 15] + "...[truncated]"
        return truncated
