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
import xml.etree.ElementTree as ET
from selenium.common.exceptions import TimeoutException

# from utils.element_util import extract_element_info
from utils.logger import log_tool_call
from utils.response_format import format_tool_response, init_tool_response
from utils.gen_code import record_calls
from tools.appium_driver_tool import get_appium_locator, simplify_page_source
from utils.logger import get_mcp_logger


logger = get_mcp_logger()


def register_verify_tools(mcp, driver_manager):
    """Register verify tools to MCP server."""

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def verify_element_exists(
        caller: str, locator_value: str, locator_strategy: str = "", step: str = "", scenario: str = "", step_raw: str = ""
    ) -> str:
        """check/verify if an element exists/appears in the current page.

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
        resp["data"] = {"page_source": simplify_page_source(page_source, max_size=500000)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def verify_element_not_exists(
        caller: str, locator_value: str, locator_strategy: str = "", step: str = "", scenario: str = "", step_raw: str = ""
    ) -> str:
        """check/verify if an element does not exist/disappear in the current page.

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
            # Use WebDriverWait to ensure the element is not present
            elements = driver.find_elements(*locator)
            if len(elements) == 0:
                resp["status"] = "success"
            else:
                resp["status"] = "error"
                resp["error"] = f"Element {locator_value} still exists"
        except Exception as e:
            if "timeout" in str(e):
                resp["status"] = "success"
            else:
                resp["status"] = "error"
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source, max_size=500000)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def verify_element_attribute(
        caller: str,
        locator_value: str,
        locator_strategy: str = "",
        attribute_name: str = "",
        expected_value: str = "",
        rule: str = "",
        step: str = "",
        scenario: str = "",
        step_raw: str = "",
    ) -> str:
        """check/verify if an element has a specific attribute with the expected value under a specific rule.

        Args:
            locator_value: required, element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: required, strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            attribute_name: required, name of the attribute to check（e.g., 'value', 'text', etc.)
            expected_value: required, expected value of the attribute
            rule: the comparison rule to apply (e.g., "==","!=","contains" etc. (default is "==")
            step: required, step name
            step_raw: required, raw original step text
            scenario: required, scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
            element = driver.find_element(*locator)
            actual_value = element.get_attribute(attribute_name)
            if rule == "":
                rule = "=="
            if rule == "==":
                if actual_value == expected_value:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} has {attribute_name}={actual_value}, expected {expected_value}"
            elif rule == "!=":
                if actual_value != expected_value:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} has {attribute_name}={actual_value}, not expected {expected_value}"
            elif rule == "contains":
                if expected_value in actual_value:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} does not contain {expected_value}, actual value is {actual_value}"
            else:
                raise ValueError(f"Unsupported rule: {rule}")
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error verifying element attribute: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source, max_size=500000)}

        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    @record_calls(driver_manager)
    async def verify_element_relative_location(
        caller: str, locator_value: str, locator_strategy: str = "",
        relative_locator_value: str = '', relative_locator_strategy: str = "",
        expected_location: str = "", step: str = "", scenario: str = "", step_raw: str = ""
    ) -> str:
        """check/verify if an element location is relative to another element or the screen. 
        if relative_locator_value and relative_locator_strategy are provided, it will check the location of the element relative to another element.
        Otherwise, it will check the location of the element relative to the screen.

        Args:
            locator_value: required, element locator value (e.g., element name, accessibility ID, etc.)
            locator_strategy: required, strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            relative_locator_value: optional, element locator value (e.g., element name, accessibility ID, etc.)
            relative_locator_strategy: optional, strategy of the locator (e.g., 'AppiumBy.ACCESSIBILITY_ID', 'AppiumBy.NAME', 'AppiumBy.XPATH')
            expected_location: required, expected location of the element (e.g., "top", "bottom", "left", "right")
            step: required, step name
            step_raw: required, raw original step text
            scenario: required, scenario name
        """
        resp = init_tool_response()
        try:
            driver = driver_manager._driver
            locator = get_appium_locator(locator_strategy, locator_value)
            WebDriverWait(driver, 5).until(EC.presence_of_element_located(locator))
            element = driver.find_element(*locator)
            x = element.location['x']
            y = element.location['y']
            if relative_locator_value and relative_locator_strategy:
                relative_locator = get_appium_locator(relative_locator_strategy, relative_locator_value)
                WebDriverWait(driver, 5).until(EC.presence_of_element_located(relative_locator))
                relative_element = driver.find_element(*relative_locator)
                relative_x = relative_element.location['x']
                relative_y = relative_element.location['y']
            else:
                relative_x = 0
                relative_y = 0
            if expected_location == "top":
                if relative_y == 0 and y < driver.get_window_size()['height'] / 3:
                    resp["status"] = "success"
                elif relative_y > 0 and y < relative_y:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} is not at the top, actual location is ({x}, {y})"
            elif expected_location == "bottom":
                if relative_y == 0 and y > driver.get_window_size()['height'] * 2 / 3:
                    resp["status"] = "success"
                elif relative_y > 0 and y > relative_y + relative_element.size['height']:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} is not at the bottom, actual location is ({x}, {y})"
            elif expected_location == "left":
                if relative_x == 0 and x < driver.get_window_size()['width'] / 3:
                    resp["status"] = "success"
                elif relative_x > 0 and x < relative_x:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} is not at the left, actual location is ({x}, {y})"
            elif expected_location == "right":
                if relative_x == 0 and x > driver.get_window_size()['width'] * 2 / 3:
                    resp["status"] = "success"
                elif relative_x > 0 and x > relative_x + relative_element.size['width']:
                    resp["status"] = "success"
                else:
                    resp["status"] = "error"
                    resp["error"] = f"Element {locator_value} is not at the right, actual location is ({x}, {y})"
            else:
                resp["status"] = "error"
                resp["error"] = f"Unsupported expected location: {expected_location}"
        except Exception as e:
            resp["error"] = repr(e)
            logger.error(f"Error verifying element location: {e}")
        page_source = driver.page_source
        resp["data"] = {"page_source": simplify_page_source(page_source, max_size=500000)}

        return json.dumps(format_tool_response(resp))

