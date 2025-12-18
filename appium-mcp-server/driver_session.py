# tools/browser_manager.py

import time
import logging
import subprocess
import os
from datetime import datetime
from appium import webdriver
from appium.options.ios import XCUITestOptions
from appium.options.mac import Mac2Options  # Add this import for Mac automation
from appium.options.android import UiAutomator2Options  # Add this for Android if needed
from utils.logger import get_mcp_logger

logger = get_mcp_logger()


def _cleanup_mac_webdriver_processes():
    """Forcefully cleanup any lingering WebDriverAgent processes on Mac"""
    try:
        # Kill WebDriverAgentRunner processes
        logger.info("Cleaning up WebDriverAgentRunner processes...")
        subprocess.run(["pkill", "-f", "WebDriverAgentRunner"], capture_output=True, check=False)

        # Kill any lingering WebDriverAgent-related processes
        subprocess.run(["pkill", "-f", "WebDriverAgent"], capture_output=True, check=False)

        # Give a moment for cleanup to complete
        time.sleep(0.5)
        logger.info("Mac WebDriverAgent process cleanup completed")

    except Exception as e:
        logger.warning(f"Error during Mac process cleanup: {e}")


class DriverSessionManager:
    def __init__(self, device: str, driver_configs: dict = None):
        if device not in driver_configs:
            raise ValueError(f"Unsupported device: {device}")
        self.device = device
        self.config = driver_configs[device]
        self.gen_code_id = None
        self.gen_code_cache = []
        self.proposed_changes = None  # Store proposed code changes
        self.header_code = ""
        self._driver = None
        self.server_url = self.config["server_url"]
        self.is_executing = False

    def start_tool_execution(self, tool_name):
        if self.is_executing:
            logger.warning(f"Tool {tool_name} blocked: another tool is executing")
            return False
        self.is_executing = True
        logger.info(f"Tool {tool_name} started execution")
        return True

    def finish_tool_execution(self, tool_name):
        self.is_executing = False
        logger.info(f"Tool {tool_name} finished execution")

    def _is_session_valid(self):
        """Check if the current driver session is still valid"""
        if not self._driver:
            return False
        try:
            # Try to get the session status to validate the session
            self._driver.get_window_size()
            return True
        except Exception as e:
            return False

    def app_launch(self, kill_existing: int = 0, arguments: list = None):
        if kill_existing == 1:
            self.app_close()

        # For Mac platform, perform forcefully cleanup any lingering WebDriverAgent processes
        if self.device == "mac":
            logger.info("Mac platform: performing process cleanup and session close before new session")
            _cleanup_mac_webdriver_processes()

        if self._driver and self._is_session_valid():
            logger.info("Driver session already exists and is valid, reusing it.")
            package = self.app_package()
            logger.info("start activate app")
            try:
                self._driver.activate_app(package)
                return self._driver
            except Exception as e:
                logger.warning(f"Failed to activate app on existing session: {e}. Creating new session.")
                self._driver = None  # Reset the driver to create a new one

        try:
            server_url = self.server_url
            logger.info(f"Connecting to Appium server at: {server_url}")
            
            # Create a copy of config to modify
            config_copy = self.config.copy()
            
            # Add or override arguments if provided
            if arguments is not None:
                config_copy["arguments"] = arguments
                logger.info(f"Using custom arguments: {arguments}")
            
            logger.info(f"Using driver config: {config_copy}")

            # Use appropriate options based on device type
            if self.device == "ios":
                options = XCUITestOptions().load_capabilities(config_copy)
            elif self.device == "mac":
                options = Mac2Options().load_capabilities(config_copy)
            elif self.device == "android":
                options = UiAutomator2Options().load_capabilities(config_copy)
            else:
                raise ValueError(f"Unsupported device type: {self.device}")

            self._driver = webdriver.Remote(server_url, options=options)
            logger.info("Driver session created successfully")

            # Try to activate app, but don't fail if method is not implemented
            package = self.app_package()
            if package and self.device in ["ios", "android"]:
                logger.info("Attempting to activate app")
                try:
                    self._driver.activate_app(package)
                    logger.info("App activated successfully")
                except Exception as e:
                    logger.warning(f"activate_app not supported or failed: {e}. Continuing without activation.")
            else:
                logger.info("Mac platform or no bundleId found, skipping app activation")

            return self._driver

        except Exception as e:
            logger.error(f"Failed to create driver session: {str(e)}")
            self._driver = None  # Ensure driver is reset on failure
            raise

    def app_package(self):
        """Get from config first (reliable), then from capabilities (fallback)"""
        # Priority 1: From config (100% reliable)
        if self.device in ["ios", "mac"]:
            package = self.config.get("bundleId")
        elif self.device == "android":
            package = self.config.get("appPackage")
        else:
            package = None
        
        if package:
            return package
        
        # Priority 2: From capabilities (fallback for compatibility)
        if self._driver:
            caps = self._driver.capabilities
            return (caps.get("bundleId") or 
                    caps.get("appium:bundleId") or 
                    caps.get("appPackage") or 
                    caps.get("appium:appPackage"))
        
        return None

    def app_close(self):
        if self._driver and self._is_session_valid():
            logger.info("Closing app session")
            package = self.app_package()
            if package and self.device in ["ios", "android"]:
                # For iOS and Android, terminate the app using bundle ID
                logging.info(f"Closing app with bundle ID: {package}")
                self._driver.terminate_app(package)
        else:
            logger.warning("No app to close or driver session is invalid.")

    def session_close(self):
        """Close the current driver session"""
        if self._driver and self._is_session_valid():
            logger.info("Closing driver session")
            self._driver.quit()
            self._driver = None
        else:
            logger.warning("No valid driver session to close.")

    def get_app(self):
        if self._driver and self._is_session_valid():
            return self._driver

        self.app_launch()
        return self._driver

    def push_data_to_gen_code(self, caller, tool_name, step, scenario, param=None):
        if self.gen_code_id:
            data = {
                "gen_code_id": self.gen_code_id,
                "tool_name": tool_name,
                "step": step,
                "scenario": scenario,
                "param": param,
                "caller": caller,
            }
            self.gen_code_cache.append(data)
        else:
            logger.warning("No gen_code_id found. Cannot push data.")

    def clear_gen_code_cache(self):
        self.gen_code_cache.clear()
        self.gen_code_id = None
        self.proposed_changes = None
        self.header_code = ""

    def is_keyboard_shown(self) -> bool | None:
        """
        Check if the keyboard is currently displayed.

        Returns:
            bool: True if the keyboard is shown, False otherwise.
        """
        if self._driver and self._is_session_valid():
            try:
                if self.device in ["android", "ios"]:
                    return self._driver.is_keyboard_shown()
                else:
                    logger.warning(f"Unsupported device type: {self.device}")
                    return None
            except Exception as e:
                logger.warning(f"Failed to check keyboard visibility: {e}")
                return None
        else:
            logger.warning("Driver session is not valid. Cannot check keyboard visibility.")
            return None
