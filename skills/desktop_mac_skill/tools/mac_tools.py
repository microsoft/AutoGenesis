"""
Mac-specific tools for Desktop Mac Skill.
Provides macOS-optimized automation tools using Appium Mac2 driver.
"""

import json
import logging
import time
from typing import Any, List, Optional

from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

from core.utils.response_format import format_tool_response, init_tool_response
from core.utils.logger import log_tool_call
from core.bdd.gen_code import record_calls
from core.llm.chat import LLMClient
from skills.mobile_skill.element_utils import get_appium_locator, simplify_page_source


logger = logging.getLogger(__name__)


def _is_menu_bar_element(element: Any, driver: Any) -> bool:
    """
    Detect menu bar elements using optimized detection rules.

    Returns True if element is likely a menu bar or dropdown menu element.
    """
    try:
        element_tag = getattr(element, 'tag_name', '')
        element_hittable = element.get_attribute('hittable') or ''
        location = element.location
        size = element.size
        width = size.get('width', 0)
        height = size.get('height', 0)
        y_pos = location.get('y', 0)

        # Rule 1: Colon ending check
        if element_tag.endswith(':'):
            if (width == 0 and height == 0) or element_hittable == 'false':
                return True

        # Rule 2: Zero-size + not-hittable check
        if width == 0 and height == 0 and element_hittable == 'false':
            return True

        # Rule 3: Top menu bar position check
        if y_pos < 50 and width > 50:
            element_type = element.get_attribute('elementType') or ''
            menu_types = ['menubar', 'menubaritem', 'menu', 'menuitem', 'popupbutton']
            menu_type_codes = ['56', '9']

            if (any(menu_type in element_type.lower() for menu_type in menu_types) or
                    element_type in menu_type_codes):
                return True

        return False

    except Exception as e:
        logger.warning(f"Menu detection failed: {e}")
        try:
            return element.location.get('y', 0) < 35
        except:
            return False


def _select_best_element(
    driver: Any,
    locator: tuple,
    locator_strategy: str,
    locator_value: str
) -> Optional[Any]:
    """
    Select the best element from multiple candidates using smart menu filtering.
    """
    try:
        elements = driver.find_elements(*locator)

        if len(elements) > 1:
            for element in elements:
                if not _is_menu_bar_element(element, driver):
                    return element
            if elements:
                return elements[0]
        elif len(elements) == 1:
            return elements[0]
        else:
            return WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))

    except Exception as e:
        logger.warning(f"Failed to select element {locator_value}: {e}")
        return None


def register_mac_tools(mcp: Any, session_manager: Any) -> None:
    """
    Register Mac-specific tools to MCP server.

    Args:
        mcp: FastMCP server instance
        session_manager: Mac session manager
    """

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def app_launch(
        caller: str = "",
        step: str = "",
        scenario: str = "",
        arguments: list = None
    ) -> str:
        """Launch Mac application

        Args:
            caller: The caller identifier
            step: Step description for logging
            scenario: Scenario description for logging
            arguments: Optional command line arguments
        """
        resp = init_tool_response()
        try:
            session_manager.app_launch(kill_existing=1, arguments=arguments)
            snapshot = session_manager._driver.page_source
            resp["data"] = {"page_source": simplify_page_source(snapshot)}
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error launching app: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def app_close(caller: str, step: str = "", scenario: str = "") -> str:
        """Close Mac application"""
        resp = init_tool_response()
        try:
            session_manager.app_close()
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error closing app: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def session_close(caller: str = "", step: str = "", scenario: str = "") -> str:
        """Close Appium session"""
        resp = init_tool_response()
        try:
            session_manager.session_close()
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error closing session: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def click_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Click element with smart menu bar filtering (macOS optimized)

        Args:
            locator_value: element locator value
            locator_strategy: strategy of the locator
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()

        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)

            selected_element = _select_best_element(driver, locator, locator_strategy, locator_value)

            if selected_element:
                try:
                    ActionChains(driver).move_to_element(selected_element).click().perform()
                    resp["status"] = "success"
                except Exception:
                    try:
                        selected_element.click()
                        resp["status"] = "success"
                    except Exception:
                        selected_element = None

            if not selected_element or resp.get("status") != "success":
                try:
                    element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
                    ActionChains(driver).move_to_element(element).click().perform()
                    resp["status"] = "success"
                except Exception as e:
                    if locator_strategy in ["AppiumBy.ACCESSIBILITY_ID", "ACCESSIBILITY_ID", ""]:
                        try:
                            xpath_locator = get_appium_locator(
                                "AppiumBy.XPATH",
                                f"//XCUIElementTypeButton[@label=\"{locator_value}\"]"
                            )
                            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(xpath_locator))
                            ActionChains(driver).move_to_element(element).click().perform()
                            resp["status"] = "success"
                        except Exception:
                            raise e
                    else:
                        raise e

            if resp.get("status") == "success":
                time.sleep(3)

            resp["data"] = {"page_source": simplify_page_source(driver.page_source)}

        except Exception as e:
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found or not clickable: {str(e)}"
            try:
                resp["data"] = {"page_source": simplify_page_source(driver.page_source)}
            except:
                resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def send_keys_on_macos(
        caller: str,
        locator_value: str,
        locator_strategy: str,
        text: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Enter text in element by macOS script

        Args:
            caller: caller name
            locator_value: element locator value
            locator_strategy: strategy of the locator
            text: text to send
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            resp["status"] = ""
            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
            element.click()
            element.clear()
            element.send_keys(text)
            current_text = element.get_attribute("value")
            if current_text is None or len(current_text) == 0:
                driver.execute_script("macos: keys", {"keys": list(text)})
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error entering text in element: {e}")
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found or not editable"

        try:
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def directly_send_keys(
        caller: str,
        text: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Send keys directly to the focused element

        Args:
            text: text to send
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            time.sleep(2)
            driver.execute_script("macos: keys", {"keys": list(text)})
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error sending keys directly: {e}")
            resp["status"] = "error"
            resp["error"] = f"Failed to send keys {text}"

        try:
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def right_click_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Right click element with smart menu filtering

        Args:
            locator_value: element locator value
            locator_strategy: strategy of the locator
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)

            selected_element = _select_best_element(driver, locator, locator_strategy, locator_value)

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

        try:
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def press_key(
        caller: str,
        key: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Press a key in Mac app

        Args:
            key: key to press (e.g., 'return', 'space', 'escape', 'command+c', etc.)
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver

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

            if "+" in key:
                parts = key.lower().split("+")
                modifiers = parts[:-1]
                actual_key = parts[-1]

                modifier_flags = 0
                for modifier in modifiers:
                    if modifier in ["command", "cmd"]:
                        modifier_flags |= 1 << 4
                    elif modifier in ["shift"]:
                        modifier_flags |= 1 << 1
                    elif modifier in ["control", "ctrl"]:
                        modifier_flags |= 1 << 2
                    elif modifier in ["option", "alt"]:
                        modifier_flags |= 1 << 3
                    elif modifier in ["fn", "function"]:
                        modifier_flags |= 1 << 5

                mapped_actual_key = key_mapping.get(actual_key.lower(), actual_key)

                time.sleep(2)
                driver.execute_script("macos: keys", {
                    "keys": [{"key": mapped_actual_key, "modifierFlags": modifier_flags}]
                })
            else:
                mapped_key = key_mapping.get(key.lower(), key)

                if len(mapped_key) == 1:
                    driver.execute_script("macos: keys", {"keys": [mapped_key]})
                else:
                    try:
                        focused_element = driver.switch_to.active_element
                        if focused_element:
                            focused_element.send_keys(mapped_key)
                        else:
                            driver.execute_script("macos: keys", {"keys": list(mapped_key)})
                    except:
                        driver.execute_script("macos: keys", {"keys": list(mapped_key)})

            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error pressing key: {e}")

        try:
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def drag_element_to_element(
        caller: str,
        source_xpath: str,
        target_xpath: str,
        drop_position: str = "center",
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Drag from one element to another element using XPath locators

        Args:
            source_xpath: XPath expression for the source element
            target_xpath: XPath expression for the target element
            drop_position: Where to drop ("center", "left", "right", "top", "bottom")
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver

            if not source_xpath or not target_xpath:
                raise Exception("Both source_xpath and target_xpath are required")

            source_locator = (AppiumBy.XPATH, source_xpath)
            target_locator = (AppiumBy.XPATH, target_xpath)

            source_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(source_locator)
            )
            target_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(target_locator)
            )

            source_location = source_element.location
            source_size = source_element.size
            target_location = target_element.location
            target_size = target_element.size

            target_x = target_location.get('x', 0)
            target_y = target_location.get('y', 0)
            target_width = target_size.get('width', 0)
            target_height = target_size.get('height', 0)

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

            actions = ActionChains(driver)
            source_center_x = source_location.get('x', 0) + source_size.get('width', 0) // 2
            source_center_y = source_location.get('y', 0) + source_size.get('height', 0) // 2
            offset_x = drop_x - source_center_x
            offset_y = drop_y - source_center_y

            try:
                actions.click_and_hold(source_element).move_by_offset(offset_x, offset_y).release().perform()
            except Exception:
                actions = ActionChains(driver)
                actions.drag_and_drop(source_element, target_element).perform()

            resp["status"] = "success"
            resp["message"] = f"Successfully dragged element to '{drop_position}' position"

        except Exception as e:
            resp["status"] = "error"
            resp["error"] = f"Failed to drag element: {str(e)}"

        try:
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def mouse_hover(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        duration: float = 1.0,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Hover mouse over an element with smart menu filtering

        Args:
            locator_value: element locator value
            locator_strategy: strategy of the locator
            duration: duration to hover in seconds
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            selected_element = _select_best_element(driver, locator, locator_strategy, locator_value)

            if not selected_element:
                raise Exception(f"Element '{locator_value}' not found")

            actions = ActionChains(driver)
            actions.move_to_element(selected_element).perform()

            if duration > 0:
                time.sleep(duration)

            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error hovering over element {locator_value}: {e}")
            resp["status"] = "error"
            resp["error"] = f"Failed to hover over element {locator_value}"

        try:
            page_source = driver.page_source
            resp["data"] = {"page_source": simplify_page_source(page_source)}
        except Exception as page_e:
            logger.warning(f"Failed to get page source: {page_e}")
            resp["data"] = {"page_source": ""}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def get_page_source_tree(
        caller: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Get current page source

        Args:
            caller: caller name
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            page_source = driver.page_source
            simplified_page_source = simplify_page_source(page_source)

            resp["status"] = "success"
            resp["data"] = {"page_source": simplified_page_source}

        except Exception as e:
            resp["error"] = repr(e)
            resp["status"] = "error"
            logger.error(f"Error getting page source tree: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def verify_visual_task(
        caller: str,
        task_description: str,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
    ) -> str:
        """
        Captures a screenshot and verifies if the visual content matches the task description.

        Args:
            caller: Calling module/function identifier
            task_description: Task to verify against the screenshot
            scenario: Test scenario name
            step_raw: Raw step text
            step: Current step description

        Returns:
            JSON response with status, verification result, reason
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            screenshot_data = driver.get_screenshot_as_png()
            client = LLMClient()
            result = client.evaluate_task(task_info=task_description, image_data=screenshot_data)

            resp["status"] = "success" if result.result else "error"
            resp["data"] = {
                "result": result.result,
                "reason": result.reason,
                "step_raw": step_raw,
            }
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_visual_task: {e}")

        return json.dumps(format_tool_response(resp))
