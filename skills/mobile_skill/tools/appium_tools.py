"""
Common Appium tools for Mobile Skill.
Tools that work across both iOS and Android platforms.
"""

import json
import logging
import time
from typing import Any

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from core.utils.response_format import format_tool_response, init_tool_response
from core.utils.logger import log_tool_call
from core.bdd.gen_code import record_calls
from core.llm.chat import is_ai_enabled, LLMClient
from skills.mobile_skill.element_utils import get_appium_locator, simplify_page_source


logger = logging.getLogger(__name__)


def register_appium_tools(mcp: Any, session_manager: Any) -> None:
    """
    Register common Appium tools to MCP server.

    Args:
        mcp: FastMCP server instance
        session_manager: Mobile session manager
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
        """Launch app

        Args:
            caller: The caller identifier
            step: Step description for logging
            scenario: Scenario description for logging
            arguments: Optional list of command line arguments to pass to the app
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
        """Close app"""
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
        """Close session"""
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
    async def find_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Find element on page, if element exists, return success, otherwise return error

        Args:
            locator_value: required, element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: strategy of the locator (e.g., 'ACCESSIBILITY_ID', 'NAME', 'XPATH')
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            time.sleep(2)
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
        resp["data"] = {"page_source": simplify_page_source(page_source, max_size=500000)}

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
        """Click element

        Args:
            locator_value: element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: strategy of the locator (e.g., 'ACCESSIBILITY_ID', 'NAME', 'XPATH')
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)

            try:
                elements = WebDriverWait(driver, 5).until(
                    EC.visibility_of_any_elements_located(locator)
                )
                if elements and len(elements) > 1:
                    logger.warning(f"Multiple elements found for locator {locator_value}.")
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

        if "page_source" not in resp.get("data", {}):
            page_source = driver.page_source
            if "data" not in resp:
                resp["data"] = {}
            resp["data"]["page_source"] = simplify_page_source(page_source)

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def send_keys(
        caller: str,
        locator_value: str,
        locator_strategy: str,
        text: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Enter text in element

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
            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
            element.click()
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
    @record_calls(session_manager)
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
            driver = session_manager._driver
            size = driver.get_window_size()
            width = size["width"]
            height = size["height"]
            min_x = width * 0.1
            max_x = width * 0.9
            min_y = height * 0.2
            max_y = height * 0.8

            start_x = max(int(min_x), min(int(max_x), start_x))
            end_x = max(int(min_x), min(int(max_x), end_x))
            start_y = max(int(min_y), min(int(max_y), start_y))
            end_y = max(int(min_y), min(int(max_y), end_y))

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
    @record_calls(session_manager)
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
            element = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))

            location = element.location
            size = element.size
            x = location["x"] + size["width"] / 2
            y = location["y"] + size["height"] / 2

            driver.tap([(x, y)])
            time.sleep(0.1)
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
    @record_calls(session_manager)
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
            locator_value: element locator value
            locator_strategy: strategy of the locator
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)

            try:
                element = driver.find_element(*locator)
                driver.execute_script("mobile: scroll", {"direction": "down", "element": element})
                resp["status"] = "success"
            except:
                max_attempts = 5
                for attempt in range(max_attempts):
                    try:
                        element = driver.find_element(*locator)
                        resp["status"] = "success"
                        break
                    except:
                        if attempt < max_attempts - 1:
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
    @record_calls(session_manager)
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
            driver = session_manager._driver
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
    @record_calls(session_manager)
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
            driver = session_manager._driver
            size = driver.get_window_size()
            center_x = size["width"] // 2
            center_y = size["height"] // 2

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
    @record_calls(session_manager)
    async def hide_keyboard(
        caller: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Hide the keyboard if it's visible

        Args:
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            try:
                driver.hide_keyboard()
                resp["status"] = "success"
            except:
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
    @record_calls(session_manager)
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
            locator_value: element locator value
            locator_type: strategy of the locator
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_type, locator_value)
            el = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
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
    @record_calls(session_manager)
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
            locator_value: element locator value
            locator_type: strategy of the locator
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_type, locator_value)
            el = WebDriverWait(driver, 5).until(EC.element_to_be_clickable(locator))
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
    @record_calls(session_manager)
    async def app_state(
        caller: str = "",
        locator_value: str = "",
        locator_type: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Get the state of the application

        Args:
            caller: caller name
            locator_value: placeholder for compatibility
            locator_type: placeholder for compatibility
            step: step name
            scenario: scenario name
            step_raw: raw original step text
        """
        resp = init_tool_response()
        data = {"is_keyboard_show": "information not available"}
        try:
            is_keyboard_shown = session_manager.is_keyboard_shown()
            if is_keyboard_shown is True:
                data["is_keyboard_show"] = "keyboard is shown"
            if is_keyboard_shown is False:
                data["is_keyboard_show"] = "keyboard is hidden"
            resp["status"] = "success"
            resp["data"] = data

        except Exception as e:
            resp["error"] = repr(e)
            resp["status"] = "error"
            logger.error(f"Error getting app state: {e}")

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
        """Get current page source with size control

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
    async def time_sleep(
        caller: str,
        seconds: int = 1,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
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

        page_source = session_manager._driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

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
            JSON response with status, verification result, reason, and error (if any)
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

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def take_screenshot(save_path: str = "") -> str:
        """
        Takes a screenshot and saves it to the specified path.

        Args:
            save_path: Path to save the screenshot

        Returns:
            JSON response with status and error (if any)
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            screenshot_data = driver.get_screenshot_as_png()
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
