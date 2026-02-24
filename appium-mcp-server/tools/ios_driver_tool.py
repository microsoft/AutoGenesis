# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

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
from tools.appium_driver_tool import get_appium_locator, simplify_page_source

        
logger = logging.getLogger(__name__)

def register_ios_driver_tools(mcp, driver_manager):
    """Register ios driver tools to MCP server."""
    
    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def dismiss_alert(caller: str, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Dismiss alert in app
        
        Args:
            step: step name
            step_raw: raw original step text
            scenario: scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            # wait for alert to be present
            WebDriverWait(driver, 10).until(EC.alert_is_present())
            # switch to alert and dismiss it
            logger.info("Attempting to dismiss alert")
            alert = driver.switch_to.alert
            if alert:
                alert.dismiss()
            resp["status"] = "success"
            page_source = driver_manager._driver.page_source
            resp["data"] = {"page_source": page_source}
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error dismissing alert: {e}")
      
        return json.dumps(format_tool_response(resp))
    
    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def directly_send_keys(caller: str, text: str, step: str = "", scenario: str = "", step_raw: str = "") -> str:
        """Enter text in element by iOS script.
        
        Args:
            caller: Caller name
            text: Text to send
            step: Step name for logging
            scenario: Scenario name for logging
            step_raw: Raw original step text for logging
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            driver.execute_script('mobile: type', {'text': text})
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = f"Error sending keys on iOS: {str(e)}"
        
        return json.dumps(format_tool_response(resp))
    
    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def long_press_element(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """Long press element

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
            element = WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
            location = element.location
            size = element.size
            x = location["x"] + size["width"] / 2
            y = location["y"] + size["height"] / 2
            duration = 2  # Duration in seconds for long press
            driver.execute_script("mobile: touchAndHold", {"x": x, "y": y, "duration": duration})
            resp["status"] = "success"
        except Exception as e:
            logger.error(f"Error right-clicking element: {e}")
        if resp["status"] == "":
            resp["status"] = "error"
            resp["error"] = f"Element {locator_value} not found or not clickable"
        if resp["status"] == "success":
            time.sleep(2)  # Wait for the long press action to complete
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source)}

        return json.dumps(format_tool_response(resp))
