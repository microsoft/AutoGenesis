# tools/browser_manager.py

import time
import logging
import subprocess
import os
import threading
from datetime import datetime
from appium import webdriver
from appium.options.ios import XCUITestOptions
from appium.options.mac import Mac2Options  # Add this import for Mac automation
from appium.options.android import UiAutomator2Options  # Add this for Android if needed
from utils.logger import get_mcp_logger

logger = get_mcp_logger()


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

        if self.device == "mac" and self._driver and self._is_session_valid():
            logger.info("Mac platform: closing existing session before new session")
            self.session_close()

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
        package_name = self._driver.capabilities.get("bundleId")
        if package_name:
            return package_name
        return self._driver.capabilities.get("appPackage")

    def app_close(self):
        if self._driver and self._is_session_valid():
            package = self.app_package()
            if package and self.device in ["ios", "android"]:
                # For iOS and Android, terminate the app using bundle ID
                logging.info(f"Closing app with bundle ID: {package}")
                self._driver.terminate_app(package)
        else:
            logger.warning("No app to close or driver session is invalid.")

    def _force_kill_mac_app(self, package):
        """Force kill a Mac app by bundle ID using osascript and kill -9"""
        try:
            logger.info(f"Force killing {package} using osascript/kill")
            cmd = ['osascript', '-e', f'tell application "System Events" to unix id of processes whose bundle identifier is "{package}"']
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split(',')
                for pid in pids:
                    pid = pid.strip()
                    if pid.isdigit():
                        logger.info(f"Killing PID {pid}")
                        subprocess.run(['kill', '-9', pid], check=False)
            else:
                logger.info(f"No running processes found for {package}")
        except Exception as e:
            logger.warning(f"Failed to force kill app: {e}")

    def session_close(self):
        """Close the current driver session"""
        if self._driver and self._is_session_valid():
            logger.info("Closing driver session")
            
            if self.device == "mac":
                package = self.app_package()
                
                # Define a wrapper for quit to run in a thread
                def quit_driver():
                    try:
                        if self._driver:
                            self._driver.quit()
                    except Exception as e:
                        logger.warning(f"Error during driver quit: {e}")

                # Run quit in a thread with timeout
                quit_thread = threading.Thread(target=quit_driver)
                quit_thread.start()
                quit_thread.join(timeout=5)  # Wait for 5 seconds
                
                if quit_thread.is_alive():
                    logger.warning("Driver quit timed out (likely stuck on dialog), forcing app kill")
                    if package:
                        self._force_kill_mac_app(package)
                    # Since we forced killed the app, the session is likely broken/gone.
                    # We don't need to wait for the thread anymore.
            else:
                try:
                    self._driver.quit()
                except Exception as e:
                    logger.warning(f"Error during driver quit: {e}")
            
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
