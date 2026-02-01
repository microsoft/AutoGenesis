"""
Android-specific tools for Mobile Skill.
Tools that are specific to Android platform.
"""

import json
import logging
import time
from typing import Any

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from core.utils.response_format import format_tool_response, init_tool_response
from core.utils.logger import log_tool_call
from core.bdd.gen_code import record_calls
from skills.mobile_skill.element_utils import get_appium_locator, simplify_page_source


logger = logging.getLogger(__name__)


def register_android_tools(mcp: Any, session_manager: Any) -> None:
    """
    Register Android-specific tools to MCP server.

    Args:
        mcp: FastMCP server instance
        session_manager: Mobile session manager
    """

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def press_key(
        caller: str,
        text: str,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Press keyboard key to the Android device.

        Args:
            caller: Caller name
            text: keycode to send (e.g., '66' for Enter, '4' for Back)
            step: Step name
            step_raw: Raw original step text
            scenario: Scenario name
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            driver.press_keycode(int(text))
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"press key code error: {e}")
            resp["status"] = "error"
            resp["error"] = f"press key code error: {str(e)}"

        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def long_press_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        duration: int = 2000,
        step: str = "",
        scenario: str = "",
        step_raw: str = ""
    ) -> str:
        """Long press on an element by its locator (Android).

        Args:
            caller: Caller name
            locator_value: Value of the locator (e.g., element ID)
            locator_strategy: Locator strategy
            duration: Duration of the long press in milliseconds (default is 2000ms)
            step: Step name
            scenario: Scenario name
            step_raw: Raw original step text
        """
        resp = init_tool_response()
        try:
            driver = session_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            element = WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
            location = element.location
            size = element.size
            x = location["x"] + size["width"] / 2
            y = location["y"] + size["height"] / 2
            driver.execute_script("mobile: longClickGesture", {"x": x, "y": y, "duration": duration})
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error long pressing element {locator_value}: {e}")
            resp["status"] = "error"
            resp["error"] = f"Error long pressing element {locator_value}: {str(e)}"

        if resp["status"] == "success":
            time.sleep(2)

        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))
