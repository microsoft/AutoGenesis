import logging
import time
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from appium import webdriver
import json
import os
import logging
import sys
import time
import inspect

# from utils.element_util import extract_element_info
from utils.logger import log_tool_call
from utils.response_format import format_tool_response, init_tool_response
from utils.gen_code import record_calls
from utils.logger import get_mcp_logger
from tools.appium_driver_tool import get_appium_locator
from tools.appium_driver_tool import simplify_page_source


logger = get_mcp_logger()


def _select_best_element(driver, locator, locator_strategy, locator_value):
    """
    Select the best element from multiple candidates using smart menu filtering.
    
    Args:
        driver: Appium driver instance
        locator: Parsed locator tuple  
        locator_strategy: Original locator strategy string
        locator_value: Original locator value string
        
    Returns:
        WebElement: Selected element or None if not found
    """
    try:
        elements = driver.find_elements(*locator)
        
        if len(elements) > 1:
            # Multiple elements: filter out menu items, select first valid one
            for element in elements:
                if not _is_menu_bar_element(element, driver):
                    return element
            # Fallback: use first element if no valid one found
            if elements:
                return elements[0]
        elif len(elements) == 1:
            return elements[0]
        else:
            # No elements found, use standard approach with wait
            return WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
            
    except Exception as e:
        logger.warning(f"Failed to select element {locator_value}: {e}")
        return None

def _is_menu_bar_element(element, driver):
    """
    Detect menu bar elements using optimized detection rules based on analysis.
    
    Returns True if element is likely a menu bar or dropdown menu element.
    """
    try:
        # Fast path: Get critical attributes only
        element_tag = getattr(element, 'tag_name', '')
        element_hittable = element.get_attribute('hittable') or ''
        location = element.location
        size = element.size
        width = size.get('width', 0)
        height = size.get('height', 0)
        y_pos = location.get('y', 0)
        
        # Rule 1: High-precision colon ending check (100% accuracy, 43% coverage)
        if element_tag.endswith(':'):
            # Additional validation for enhanced reliability
            if (width == 0 and height == 0) or element_hittable == 'false':
                return True
        
        # Rule 2: High-coverage zero-size + not-hittable check (~80% coverage)
        if (width == 0 and height == 0 and element_hittable == 'false'):
            return True
        
        # Rule 3: Top menu bar position check (fallback)
        if y_pos < 50 and width > 50:
            # Quick elementType check for menu types
            element_type = element.get_attribute('elementType') or ''
            
            # Check for both string types and numeric elementType codes
            menu_types = ['menubar', 'menubaritem', 'menu', 'menuitem', 'popupbutton']
            menu_type_codes = ['56', '9']  # elementType 56 appears to be menu bar items, 9 is buttons

            if (any(menu_type in element_type.lower() for menu_type in menu_types) or
                element_type in menu_type_codes):
                return True
        
        return False
        
    except Exception as e:
        logger.warning(f"Menu detection failed: {e}")
        # Conservative fallback: simple position check
        try:
            return element.location.get('y', 0) < 35
        except:
            return False

async def click_element_macos(caller: str, locator_value: str, locator_strategy: str = "", step: str = "", scenario: str = "", step_raw: str = "", driver_manager=None) -> str:
    """macOS optimized click element with smart menu bar filtering
    
    Uses optimized menu detection to select the best clickable element.
    """
    resp = init_tool_response()

    try:
        driver = driver_manager._driver
        locator = get_appium_locator(locator_strategy, locator_value)
        
        # Use smart element selection
        selected_element = _select_best_element(driver, locator, locator_strategy, locator_value)
        
        # Try to click the selected element
        if selected_element:
            try:
                # Try ActionChains first (more reliable)
                ActionChains(driver).move_to_element(selected_element).click().perform()
                resp["status"] = "success"
            except Exception:
                # Fallback to direct click
                try:
                    selected_element.click()
                    resp["status"] = "success"
                except Exception:
                    selected_element = None
        
        # Standard fallback if smart selection failed
        if not selected_element or resp.get("status") != "success":
            try:
                element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
                ActionChains(driver).move_to_element(element).click().perform()
                resp["status"] = "success"
            except Exception as e:
                # XPATH fallback for accessibility ID
                if locator_strategy in ["AppiumBy.ACCESSIBILITY_ID", "ACCESSIBILITY_ID", ""]:
                    try:
                        xpath_locator = get_appium_locator("AppiumBy.XPATH", 
                                                         f"//XCUIElementTypeButton[@label=\"{locator_value}\"]")
                        element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(xpath_locator))
                        ActionChains(driver).move_to_element(element).click().perform()
                        resp["status"] = "success"
                    except Exception:
                        raise e
                else:
                    raise e
        
        if resp.get("status") == "success":
            time.sleep(3)

        # Add page source to response
        resp["data"] = {"page_source": simplify_page_source(driver.page_source)}
        
    except Exception as e:
        resp["status"] = "error"
        resp["error"] = f"Element {locator_value} not found or not clickable: {str(e)}"
        try:
            resp["data"] = {"page_source": simplify_page_source(driver.page_source)}
        except:
            resp["data"] = {"page_source": ""}

    return format_tool_response(resp)


def register_mac_driver_tools(mcp, driver_manager):
    """Register ios driver tools to MCP server."""

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def send_keys_on_macos(
        caller: str, locator_value: str, locator_strategy: str, text: str, step: str = "", scenario: str = "", step_raw: str = ""
    ) -> str:
        """enter text in element by macos script
        Args:
            caller: caller name
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            text: text to send
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            resp["status"] = ""
            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
            element.click()
            # Clear existing text first
            element.clear()
            element.send_keys(text)
            current_text = element.get_attribute("value")
            if current_text is None or len(current_text) == 0:
                # If value is None or empty, use os-level input
                driver.execute_script("macos: keys", {"keys": list(text)})
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error entering text in element: {e}")
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found or not editable"
        
        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def directly_send_keys(caller: str, text: str, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Send keys directly to the focused element

        Args:
            text: text to send
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            # Use macos script to send keys directly
            time.sleep(2)
            driver.execute_script("macos: keys", {"keys": list(text)})
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error sending keys directly: {e}")
            resp["status"] = "error"
            resp["error"] = f"Failed to send keys {text}"
        
        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def right_click_element(caller: str, locator_value: str, locator_strategy: str = "", step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Right click element with smart menu filtering

        Args:
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            
            # Apply smart menu filtering
            selected_element = _select_best_element(driver, locator, locator_strategy, locator_value)
            
            # Perform right-click
            if selected_element:
                actions = ActionChains(driver)
                actions.context_click(selected_element).perform()
                resp["status"] = "success"
            else:
                resp["status"] = "error"
                resp["error"] = f"Element {locator_value} not found"
                
        except Exception as e:
            logger.error(f"Error right-clicking element: {e}")
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found or not clickable"
        
        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def press_key(caller: str, key: str, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Press a key in Mac app

        Args:
            key: key to press (e.g., 'return', 'space', 'escape', 'command+c', etc.)
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver

            # Map common key names to their actual key codes or characters
            key_mapping = {
                "return": "\n",
                "enter": "\n",
                "space": " ",
                "tab": "\t",
                "escape": "\x1b",
                "backspace": "\x08",
                "delete": "\x7f",
                ".": ".",
            }

            # Handle key combinations (e.g., 'command+c', 'shift+cmd+.')
            if "+" in key:
                parts = key.lower().split("+")
                modifiers = parts[:-1]  # All parts except the last one are modifiers
                actual_key = parts[-1]  # Last part is the actual key

                # Build modifier flags as integer bitmask
                modifier_flags = 0
                for modifier in modifiers:
                    if modifier in ["command", "cmd"]:
                        modifier_flags |= 1 << 4  # Command
                    elif modifier in ["shift"]:
                        modifier_flags |= 1 << 1  # Shift
                    elif modifier in ["control", "ctrl"]:
                        modifier_flags |= 1 << 2  # Control
                    elif modifier in ["option", "alt"]:
                        modifier_flags |= 1 << 3  # Option/Alt
                    elif modifier in ["fn", "function"]:
                        # fn(Function) key support – using next free bit (1<<5) consistent with pattern above
                        # NOTE: In native macOS NSEventModifierFlags, Function key is a higher bit (0x800000),
                        # but the simplified scheme here uses sequential bits. Adjust if upstream changes.
                        modifier_flags |= 1 << 5  # Fn

                # Map the actual key if needed
                mapped_actual_key = key_mapping.get(actual_key.lower(), actual_key)

                # Use macos: keys with proper modifier flags
                time.sleep(2)  # Ensure the app is ready to receive input
                driver.execute_script("macos: keys", {"keys": [{"key": mapped_actual_key, "modifierFlags": modifier_flags}]})
            else:
                # Handle single keys
                mapped_key = key_mapping.get(key.lower(), key)

                if len(mapped_key) == 1:
                    # Single character - use macos: keys
                    driver.execute_script("macos: keys", {"keys": [mapped_key]})
                else:
                    # Multi-character string - use typeText on focused element
                    # First try to find an active text field
                    try:
                        focused_element = driver.switch_to.active_element
                        if focused_element:
                            focused_element.send_keys(mapped_key)
                        else:
                            # No focused element, try to type at system level
                            driver.execute_script("macos: keys", {"keys": list(mapped_key)})
                    except:
                        # Fallback: convert to individual characters
                        driver.execute_script("macos: keys", {"keys": list(mapped_key)})

            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error pressing key: {e}")
        
        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def drag_element_to_element(caller: str, source_xpath: str, target_xpath: str, drop_position: str = "center", step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Drag from one element to another element using XPath locators with precise drop positioning

        Args:
            source_xpath: XPath expression for the source element to drag from
            target_xpath: XPath expression for the target element to drag to
            drop_position: Where to drop relative to target element - "center", "left", "right", "top", "bottom", "left_edge", "right_edge"
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            
            # Validate XPath inputs
            if not source_xpath or not target_xpath:
                raise Exception("Both source_xpath and target_xpath are required")
            
            # Find elements directly using WebDriverWait
            source_locator = (AppiumBy.XPATH, source_xpath)
            target_locator = (AppiumBy.XPATH, target_xpath)
            
            source_element = WebDriverWait(driver, 10).until(EC.presence_of_element_located(source_locator))
            target_element = WebDriverWait(driver, 10).until(EC.presence_of_element_located(target_locator))
            
            # Get element positions
            source_location = source_element.location
            source_size = source_element.size
            target_location = target_element.location  
            target_size = target_element.size
            
            target_x = target_location.get('x', 0)
            target_y = target_location.get('y', 0)
            target_width = target_size.get('width', 0)
            target_height = target_size.get('height', 0)
            
            # Calculate drop coordinates based on drop_position
            position_map = {
                "center": (target_x + target_width // 2, target_y + target_height // 2),
                "left": (target_x + target_width // 4, target_y + target_height // 2),
                "right": (target_x + 3 * target_width // 4, target_y + target_height // 2),
                "left_edge": (target_x + 5, target_y + target_height // 2),
                "right_edge": (target_x + target_width - 5, target_y + target_height // 2),
                "top": (target_x + target_width // 2, target_y + target_height // 4),
                "bottom": (target_x + target_width // 2, target_y + 3 * target_height // 4)
            }
            
            drop_x, drop_y = position_map.get(drop_position, position_map["center"])
            
            # Perform drag and drop using ActionChains
            actions = ActionChains(driver)
            source_center_x = source_location.get('x', 0) + source_size.get('width', 0) // 2
            source_center_y = source_location.get('y', 0) + source_size.get('height', 0) // 2
            offset_x = drop_x - source_center_x
            offset_y = drop_y - source_center_y
            
            try:
                # Try precise offset-based drag first
                actions.click_and_hold(source_element).move_by_offset(offset_x, offset_y).release().perform()
            except Exception:
                # Fallback: Use standard drag_and_drop to element center
                actions = ActionChains(driver)
                actions.drag_and_drop(source_element, target_element).perform()
            
            resp["status"] = "success"
            resp["message"] = f"Successfully dragged element to '{drop_position}' position"
            
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = f"Failed to drag element: {str(e)}"
        
        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def mouse_hover(caller: str, locator_value: str, locator_strategy: str = "", duration: float = 1.0, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Hover mouse over an element with smart menu filtering

        Args:
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            duration: duration to hover in seconds
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            
            # Find the element with smart menu filtering
            locator = get_appium_locator(locator_strategy, locator_value)
            selected_element = _select_best_element(driver, locator, locator_strategy, locator_value)
            
            if not selected_element:
                raise Exception(f"Element '{locator_value}' not found")
            
            # Use ActionChains to perform hover
            actions = ActionChains(driver)
            actions.move_to_element(selected_element).perform()
            
            # Wait for the specified duration
            if duration > 0:
                time.sleep(duration)

            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error hovering over element {locator_value}: {e}")
            resp["status"] = "error"
            resp["error"] = f"Failed to hover over element {locator_value}"

        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def verify_elements_order(caller: str, element_xpaths: list[str], expected_orders: list[int] = [], direction: str = "vertical", step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Verify that elements appear in the specified order using XPath locators for better performance and stability
        
        Args:
            caller: caller name
            element_xpaths: List of XPath expressions to verify order for
            expected_orders: Optional list of expected order indices. If not provided, elements are expected to be in the same order as element_xpaths
            direction: Direction to check order - 'vertical' (y-axis) or 'horizontal' (x-axis)
            step: step name
            scenario: scenario name  
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            elements_positions = []
            
            # Find all elements using XPath
            for i, xpath in enumerate(element_xpaths):
                try:
                    locator = (AppiumBy.XPATH, xpath)
                    element = WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
                    
                    location = element.location
                    size = element.size
                    
                    elements_positions.append({
                        'name': f"Element_{i}",
                        'xpath': xpath,
                        'index': i,
                        'x': location.get('x', 0),
                        'y': location.get('y', 0),
                        'width': size.get('width', 0),
                        'height': size.get('height', 0),
                        'element': element
                    })
                        
                except Exception as e:
                    logger.warning(f"Failed to locate element with XPath '{xpath}': {e}")
                    continue
            
            if len(elements_positions) < 2:
                resp["status"] = "error" 
                resp["error"] = f"Need at least 2 elements to verify order. Found: {len(elements_positions)} elements"
                return format_tool_response(resp)
            
            # Sort elements by position based on direction
            if direction.lower() == "vertical":
                sorted_elements = sorted(elements_positions, key=lambda elem: elem['y'])
                position_key = 'y'
            elif direction.lower() == "horizontal":
                sorted_elements = sorted(elements_positions, key=lambda elem: elem['x'])
                position_key = 'x'
            else:
                resp["status"] = "error"
                resp["error"] = f"Invalid direction '{direction}'. Use 'vertical' or 'horizontal'"
                return format_tool_response(resp)
            
            # Get actual order of elements based on their positions
            actual_order = [elem['index'] for elem in sorted_elements]
            
            # Determine expected order
            if expected_orders:
                if len(expected_orders) != len(element_xpaths):
                    resp["status"] = "error"
                    resp["error"] = f"expected_orders length ({len(expected_orders)}) must match element_xpaths length ({len(element_xpaths)})"
                    return format_tool_response(resp)
                expected = expected_orders
            else:
                expected = list(range(len(element_xpaths)))
            
            # Filter expected order to only include found elements
            found_indices = [elem['index'] for elem in elements_positions]
            filtered_expected = [i for i, idx in enumerate(expected) if idx in found_indices]
            
            # Check if order matches
            is_correct_order = actual_order == filtered_expected
            
            # Create result information
            result_details = {
                'direction': direction,
                'elements_found': len(elements_positions),
                'elements_total': len(element_xpaths),
                'actual_order': actual_order,
                'expected_order': filtered_expected,
                'is_correct_order': is_correct_order
            }
            
            if is_correct_order:
                resp["status"] = "success"
                resp["message"] = f"Elements are in the correct {direction} order"
            else:
                resp["status"] = "failed"
                resp["error"] = f"Elements are not in the expected {direction} order. Expected: {filtered_expected}, Actual: {actual_order}"
            
            resp["data"] = result_details
            
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = f"Failed to verify elements order: {str(e)}"
        
        # Try to get page source safely
        try:
            driver = driver_manager._driver
            page_source = driver.page_source
            if "data" not in resp:
                resp["data"] = {}
            resp["data"]["page_source"] = simplify_page_source(page_source)
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            if "data" not in resp:
                resp["data"] = {}
            resp["data"]["page_source"] = ""

        return json.dumps(format_tool_response(resp))
