# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from typing import Optional
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import logging
import time
import io
import json

# from utils.element_util import extract_element_util
from utils.logger import log_tool_call
from utils.response_format import format_tool_response, init_tool_response
from utils.gen_code import record_calls
from utils.element_util import simplify_page_source
from llm.chat import is_ai_enabled, LLMClient
from utils.logger import get_mcp_logger

logger = get_mcp_logger()


def get_appium_locator(locator_strategy_str: str, locator_value: str):
    """Convert string locator strategy to AppiumBy locator tuple"""
    strategy_mapping = {
        "": AppiumBy.ACCESSIBILITY_ID,  # Default to ACCESSIBILITY_ID if empty
        "AppiumBy.ACCESSIBILITY_ID": AppiumBy.ACCESSIBILITY_ID,
        "AppiumBy.NAME": AppiumBy.NAME,
        "AppiumBy.ID": AppiumBy.ID,
        "AppiumBy.CLASS_NAME": AppiumBy.CLASS_NAME,
        "AppiumBy.XPATH": AppiumBy.XPATH,
        "AppiumBy.IOS_PREDICATE": AppiumBy.IOS_PREDICATE,
        "AppiumBy.IOS_CLASS_CHAIN": AppiumBy.IOS_CLASS_CHAIN,
        "AppiumBy.ANDROID_UIAUTOMATOR": AppiumBy.ANDROID_UIAUTOMATOR,
        "AppiumBy.ANDROID_VIEWTAG": AppiumBy.ANDROID_VIEWTAG,
        "ACCESSIBILITY_ID": AppiumBy.ACCESSIBILITY_ID,  # Alias for ACCESSIBILITY_ID
        "NAME": AppiumBy.NAME,
        "ID": AppiumBy.ID,
        "CLASS_NAME": AppiumBy.CLASS_NAME,
        "XPATH": AppiumBy.XPATH,
        "IOS_PREDICATE": AppiumBy.IOS_PREDICATE,
        "IOS_CLASS_CHAIN": AppiumBy.IOS_CLASS_CHAIN,
        "ANDROID_UIAUTOMATOR": AppiumBy.ANDROID_UIAUTOMATOR,
        "ANDROID_VIEWTAG": AppiumBy.ANDROID_VIEWTAG,
        # Support lowercase formats
        "accessibility_id": AppiumBy.ACCESSIBILITY_ID,
        "name": AppiumBy.NAME,
        "id": AppiumBy.ID,
        "class_name": AppiumBy.CLASS_NAME,
        "xpath": AppiumBy.XPATH,
        "ios_predicate": AppiumBy.IOS_PREDICATE,
        "ios_class_chain": AppiumBy.IOS_CLASS_CHAIN,
        "android_uiautomator": AppiumBy.ANDROID_UIAUTOMATOR,
        "android_viewtag": AppiumBy.ANDROID_VIEWTAG,
    }

    locator_strategy_str = locator_strategy_str.strip() if locator_strategy_str else ""

    appium_by = strategy_mapping.get(locator_strategy_str)

    return (appium_by, locator_value)


def register_appium_driver_tools(mcp, driver_manager):
    """Register appium driver tools to MCP server."""

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def app_launch(caller: str = "", step: str = "", scenario: str = "", arguments: Optional[list] = None) -> str:
        """Launch app

        Args:
            caller: The caller identifier
            step: Step description for logging
            scenario: Scenario description for logging
            arguments: Optional list of command line arguments to pass to the app.
                      For Mac Edge, you can use ["--no-first-run"] to skip first run setup,
                      ["--disable-web-security"] to disable web security, etc.
        """
        resp = init_tool_response()
        try:
            # Normalize arguments: treat None, empty list, or non-list values as None
            if not isinstance(arguments, list) or not arguments:
                arguments = None
            driver_manager.app_launch(kill_existing=1, arguments=arguments)
            snapshot = driver_manager._driver.page_source
            resp["data"] = {"page_source": simplify_page_source(snapshot)}
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error launching app: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def app_close(caller: str, step: str = "", scenario: str = "") -> str:
        """Close app"""
        resp = init_tool_response()
        try:
            driver_manager.app_close()
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error closing app: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def session_close(caller: str = "", step: str = "", scenario: str = "") -> str:
        """Close session"""
        resp = init_tool_response()
        try:
            driver_manager.session_close()
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error closing session: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def find_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """find element on page, if element exists, return success, otherwise return error

        Args:
            locator_value: required, element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: required, strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            step: required, step name
            step_raw: required, raw original step text
            scenario: required, scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            time.sleep(2)  # Wait for the page to load
            # Use WebDriverWait to ensure the element is present and visible
            WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
            elements = driver.find_elements(*locator)
            if len(elements) > 0:
                resp["status"] = "success"
            else:
                resp["status"] = "error"
                resp["error"] = f"Element {locator_value} not found"
        except TimeoutException:
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error verifying element: {e}")
            
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def click_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Click element

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
            platform = driver.capabilities.get("platformName", "unknown")

            # For macOS, delegate to mac-specific implementation
            if platform.lower() == "mac":
                logger.info("Detected macOS platform - delegating to mac_driver_tool")
                from tools.mac_driver_tool import click_element_macos

                return await click_element_macos(caller, locator_value, locator_strategy, step, scenario, step_raw, driver_manager)

            locator = get_appium_locator(locator_strategy, locator_value)

            try:
                elements = WebDriverWait(driver, 5).until(EC.visibility_of_any_elements_located(locator))
                if elements and len(elements) > 1:
                    logger.warning(f"Multiple elements found for locator {locator_value}. Retrun error.")
                    resp["status"] = "error"
                    resp["error"] = f"Multiple elements found for locator {locator_value}. Please refine your locator."
                else:
                    WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator)).click()
                    resp["status"] = "success"
            except Exception as e:
                logger.error(f"Error clicking element: {e}")
                resp["status"] = "error"
                resp["error"] = f"Element {locator_value} not found or not clickable"

        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error in click_element: {e}")
            resp["status"] = "error"

        if resp.get("status") == "success":
            time.sleep(3)

        # Capture page_source only if not already captured
        if "page_source" not in resp.get("data", {}):
            page_source = driver.page_source
            if "data" not in resp:
                resp["data"] = {}
            resp["data"]["page_source"] = simplify_page_source(page_source)
        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def send_keys(
        caller: str,
        locator_value: str,
        locator_strategy: str,
        text: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """enter text in element
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
            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
            element.click()
            # Clear existing text first
            element.clear()
            element.send_keys(text)
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error entering text in element: {e}")
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found or not editable"
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def swipe(
        caller: str,
        start_x: int,
        start_y: int,
        end_x: int,
        end_y: int,
        duration: int = 1000,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Swipe from one point to another

        Args:
            caller: caller name
            start_x: starting x coordinate
            start_y: starting y coordinate
            end_x: ending x coordinate
            end_y: ending y coordinate
            duration: duration of swipe in milliseconds (default: 1000)
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            size = driver.get_window_size()
            width = size["width"]
            height = size["height"]
            min_x = width * 0.1
            max_x = width * 0.9
            min_y = height * 0.2
            max_y = height * 0.8

            if start_x < min_x:
                start_x = int(min_x)
            if start_x > max_x:
                start_x = int(max_x)
            if end_x < min_x:
                end_x = int(min_x)
            if end_x > max_x:
                end_x = int(max_x)
            if start_y < min_y:
                start_y = int(min_y)
            if start_y > max_y:
                start_y = int(max_y)
            if end_y < min_y:
                end_y = int(min_y)
            if end_y > max_y:
                end_y = int(max_y)

            driver.swipe(start_x, start_y, end_x, end_y, duration)
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error performing swipe: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def double_click_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Double click element

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
            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))

            # Get element location and size for double tap
            location = element.location
            size = element.size
            x = location["x"] + size["width"] / 2
            y = location["y"] + size["height"] / 2

            # Perform double tap using coordinates
            driver.tap([(x, y)])
            time.sleep(0.1)  # Small delay between taps
            driver.tap([(x, y)])

            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error double clicking element: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def scroll_to_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Scroll to make element visible

        Args:
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)

            # Try to find element first
            try:
                element = driver.find_element(*locator)
                # If element is found, scroll to it
                driver.execute_script("mobile: scroll", {"direction": "down", "element": element})
                resp["status"] = "success"
            except:
                # If element not found, try scrolling down to find it
                max_attempts = 5
                for attempt in range(max_attempts):
                    try:
                        element = driver.find_element(*locator)
                        resp["status"] = "success"
                        break
                    except:
                        if attempt < max_attempts - 1:
                            # Scroll down and try again
                            size = driver.get_window_size()
                            start_x = size["width"] // 2
                            start_y = size["height"] * 3 // 4
                            end_x = size["width"] // 2
                            end_y = size["height"] // 4
                            driver.swipe(start_x, start_y, end_x, end_y, 1000)
                            time.sleep(1)
                        else:
                            resp["status"] = "error"
                            resp["error"] = f"Element {locator_value} not found after scrolling"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error scrolling to element: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def tap_coordinates(
        caller: str,
        x: int,
        y: int,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Tap at specific coordinates

        Args:
            x: x coordinate to tap
            y: y coordinate to tap
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            platform = driver.capabilities.get("platformName", "unknown")

            if platform.lower() == "mac":
                from tools.mac_driver_tool import tap_coordinates_macos
                return await tap_coordinates_macos(caller, x, y, step, scenario, step_raw, driver_manager)

            driver.tap([(x, y)])
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error tapping coordinates: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def pinch_zoom(
        caller: str,
        scale: float = 2.0,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Perform pinch zoom gesture

        Args:
            scale: zoom scale factor (default: 2.0, >1 for zoom in, <1 for zoom out)
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            size = driver.get_window_size()
            center_x = size["width"] // 2
            center_y = size["height"] // 2

            # Execute pinch gesture
            driver.execute_script("mobile: pinch", {"scale": scale, "x": center_x, "y": center_y})

            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error performing pinch zoom: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def hide_keyboard(caller: str, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Hide the keyboard if it's visible

        Args:
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            try:
                driver.hide_keyboard()
                resp["status"] = "success"
            except:
                # Keyboard might not be visible, that's ok
                resp["status"] = "success"
                resp["data"] = {"message": "Keyboard was not visible or already hidden"}

        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error hiding keyboard: {e}")
        page_source = driver.page_source
        resp["data"]["page_source"] = page_source

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def switch_element_to_on(
        caller: str,
        locator_value: str,
        locator_type: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Switch a specific element to the 'on' state

        Args:
            caller: caller name
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_type: strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_type, locator_value)
            # Wait for the element to be present and clickable
            el = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
            # Use JavaScript to click the element
            status = el.get_attribute("value") or el.get_attribute("checked") or el.get_attribute("aria-checked")
            status = str(status).lower() if status else "false"
            if status not in ["true", "1", "on", "checked"]:
                driver.execute_script("arguments[0].click();", el)
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error switching element to on: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def switch_element_to_off(
        caller: str,
        locator_value: str,
        locator_type: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Switch a specific element to the 'off' state

        Args:
            caller: caller name
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_type: strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_type, locator_value)
            # Wait for the element to be present and clickable
            el = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
            # Use JavaScript to click the element
            status = el.get_attribute("value") or el.get_attribute("checked") or el.get_attribute("aria-checked")
            status = str(status).lower() if status else "true"
            if status not in ["false", "0", "off", "unchecked"]:
                driver.execute_script("arguments[0].click();", el)
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error switching element to off: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def app_state(
        caller: str = "",
        locator_value: str = "",
        locator_type: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Get the state of the application, e.g., whether application is launched, is keyboard show.

        Args:
            caller: caller name
            locator_value: just a placeholder for compatibility, not used
            locator_type: just a placeholder for compatibility, not used
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        data = {"is_keyboard_show": "information not available"}
        try:
            is_keyboard_shown = driver_manager.is_keyboard_shown()
            if is_keyboard_shown is True:
                data["is_keyboard_show"] = "keyboard is shown"
            if is_keyboard_shown is False:
                data["is_keyboard_show"] = "keyboard is hidden"
            resp["status"] = "success"
            resp["data"] = data

        except Exception as e:
            resp["error"] = repr(e)
            resp["status"] = "error"
            logger.error(f"Error switching element to off: {e}")

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def get_page_source_tree(
        caller: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Get current page source with size control

        Args:
            caller: caller name
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            page_source = driver.page_source

            # Use simplify_page_source to control the size
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
    @record_calls(driver_manager)
    async def time_sleep(caller: str, seconds: int = 1, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Sleep for a specified number of seconds

        Args:
            caller: caller name
            seconds: number of seconds to sleep (default: 1)
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            time.sleep(seconds)
            resp["status"] = "success"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error sleeping for {seconds} seconds: {e}")
        page_source = driver_manager._driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def verify_visual_task(
        caller: str,
        task_description: str,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
    ) -> str:
        """
        Captures a screenshot and verifies if the visual content matches the task description.

        Combines screenshot capture and visual analysis to verify UI content automatically.
        Ideal for visual verification in automated testing scenarios.

        Args:
            caller (str): Calling module/function identifier
            task_description (str): Task to verify against the screenshot
            scenario (str): Test scenario name
            step_raw (str): Raw step text
            step (str): Current step description

        Returns:
            str: JSON response with status, verification result, reason, and error (if any)

        Note:
            - Automatically captures PNG screenshot from main window

        """
        resp = init_tool_response()
        try:
            # Capture the screenshot
            driver = driver_manager._driver
            screenshot_data = driver.get_screenshot_as_png()
            # Initialize LLMClient
            client = LLMClient()

            # Call evaluate_task
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

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def take_screenshot(save_path: str = ""):
        """
        Takes a screenshot and saves it to the specified path.

        Args:
            save_path (str): Path to save the screenshot

        Returns:
            str: JSON response with status and error (if any)
        """
        resp = init_tool_response()
        try:
            # Capture the screenshot
            driver = driver_manager._driver
            screenshot_data = driver.get_screenshot_as_png()
            # Initialize LLMClient
            client = LLMClient()
            compress_data = client.compress_image(image_data=screenshot_data)
            with open(save_path, "wb") as f:
                f.write(compress_data)

            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in take_screenshot: {e}")

        return json.dumps(format_tool_response(resp))
