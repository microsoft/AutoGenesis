"""
Session Manager for Mobile Skill.
Manages Appium driver sessions for iOS and Android platforms.
"""

import logging
import subprocess
import threading
from typing import Any, Dict, List, Optional

from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.options.ios import XCUITestOptions

from core.utils.logger import get_mcp_logger


logger = get_mcp_logger()


class MobileSessionManager:
    """
    Manages Appium driver sessions for mobile testing.

    Responsibilities:
    - Create and manage Appium driver sessions
    - Handle app launch/close operations
    - Track code generation cache
    - Provide session validation
    """

    def __init__(self, platform: str, driver_configs: Dict[str, Any]):
        """
        Initialize the session manager.

        Args:
            platform: Target platform ('ios' or 'android')
            driver_configs: Platform-specific driver configurations
        """
        if platform not in driver_configs:
            raise ValueError(f"Unsupported platform: {platform}")

        self.platform = platform
        self.config = driver_configs[platform]
        self.gen_code_id: Optional[str] = None
        self.gen_code_cache: List[Dict[str, Any]] = []
        self.proposed_changes: Optional[str] = None
        self.header_code: str = ""
        self._driver: Optional[webdriver.Remote] = None
        self.server_url: str = self.config["server_url"]
        self.is_executing: bool = False

    def start_tool_execution(self, tool_name: str) -> bool:
        """
        Mark the start of a tool execution (for serialization).

        Args:
            tool_name: Name of the tool being executed

        Returns:
            True if execution can proceed, False if blocked
        """
        if self.is_executing:
            logger.warning(f"Tool {tool_name} blocked: another tool is executing")
            return False
        self.is_executing = True
        logger.info(f"Tool {tool_name} started execution")
        return True

    def finish_tool_execution(self, tool_name: str) -> None:
        """Mark the end of a tool execution."""
        self.is_executing = False
        logger.info(f"Tool {tool_name} finished execution")

    def _is_session_valid(self) -> bool:
        """Check if the current driver session is still valid."""
        if not self._driver:
            return False
        try:
            self._driver.get_window_size()
            return True
        except Exception:
            return False

    def app_launch(
        self,
        kill_existing: int = 0,
        arguments: Optional[List[str]] = None
    ) -> webdriver.Remote:
        """
        Launch the mobile application.

        Args:
            kill_existing: If 1, close existing app first
            arguments: Optional command line arguments

        Returns:
            The Appium driver instance
        """
        if kill_existing == 1:
            self.app_close()

        if self._driver and self._is_session_valid():
            logger.info("Driver session already exists and is valid, reusing it.")
            package = self.app_package()
            logger.info("Attempting to activate app")
            try:
                self._driver.activate_app(package)
                return self._driver
            except Exception as e:
                logger.warning(
                    f"Failed to activate app on existing session: {e}. Creating new session."
                )
                self._driver = None

        try:
            server_url = self.server_url
            logger.info(f"Connecting to Appium server at: {server_url}")

            config_copy = self.config.copy()

            if arguments is not None:
                config_copy["arguments"] = arguments
                logger.info(f"Using custom arguments: {arguments}")

            logger.info(f"Using driver config: {config_copy}")

            if self.platform == "ios":
                options = XCUITestOptions().load_capabilities(config_copy)
            elif self.platform == "android":
                options = UiAutomator2Options().load_capabilities(config_copy)
            else:
                raise ValueError(f"Unsupported platform: {self.platform}")

            self._driver = webdriver.Remote(server_url, options=options)
            logger.info("Driver session created successfully")

            package = self.app_package()
            if package:
                logger.info("Attempting to activate app")
                try:
                    self._driver.activate_app(package)
                    logger.info("App activated successfully")
                except Exception as e:
                    logger.warning(
                        f"activate_app not supported or failed: {e}. Continuing without activation."
                    )

            return self._driver

        except Exception as e:
            logger.error(f"Failed to create driver session: {str(e)}")
            self._driver = None
            raise

    def app_package(self) -> Optional[str]:
        """
        Get the app package/bundle ID.

        Returns:
            Package name or bundle ID
        """
        if self.platform == "ios":
            package = self.config.get("bundleId")
        elif self.platform == "android":
            package = self.config.get("appPackage")
        else:
            package = None

        if package:
            return package

        if self._driver:
            caps = self._driver.capabilities
            return (
                caps.get("bundleId")
                or caps.get("appium:bundleId")
                or caps.get("appPackage")
                or caps.get("appium:appPackage")
            )

        return None

    def app_close(self) -> None:
        """Close the mobile application."""
        if self._driver and self._is_session_valid():
            package = self.app_package()
            if package:
                logger.info(f"Closing app with bundle ID: {package}")
                try:
                    self._driver.terminate_app(package)
                except Exception as e:
                    logger.warning(f"Failed to terminate app: {e}")
        else:
            logger.warning("No app to close or driver session is invalid.")

    def session_close(self) -> None:
        """Close the driver session."""
        if self._driver and self._is_session_valid():
            logger.info("Closing driver session")
            try:
                self._driver.quit()
            except Exception as e:
                logger.warning(f"Error during driver quit: {e}")
            self._driver = None
        else:
            logger.warning("No valid driver session to close.")

    def get_app(self) -> webdriver.Remote:
        """
        Get the driver, launching the app if needed.

        Returns:
            The Appium driver instance
        """
        if self._driver and self._is_session_valid():
            return self._driver

        self.app_launch()
        return self._driver

    def push_data_to_gen_code(
        self,
        caller: str,
        tool_name: str,
        step: str,
        scenario: str,
        param: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Push data to the code generation cache.

        Args:
            caller: Caller identifier
            tool_name: Name of the tool called
            step: BDD step text
            scenario: Scenario name
            param: Tool parameters
        """
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

    def clear_gen_code_cache(self) -> None:
        """Clear the code generation cache."""
        self.gen_code_cache.clear()
        self.gen_code_id = None
        self.proposed_changes = None
        self.header_code = ""

    def is_keyboard_shown(self) -> Optional[bool]:
        """
        Check if the keyboard is currently displayed.

        Returns:
            True if keyboard is shown, False if hidden, None if unavailable
        """
        if self._driver and self._is_session_valid():
            try:
                return self._driver.is_keyboard_shown()
            except Exception as e:
                logger.warning(f"Failed to check keyboard visibility: {e}")
                return None
        else:
            logger.warning("Driver session is not valid. Cannot check keyboard visibility.")
            return None

    @property
    def driver(self) -> Optional[webdriver.Remote]:
        """Get the current driver instance."""
        return self._driver

    def __repr__(self) -> str:
        status = "connected" if self._is_session_valid() else "disconnected"
        return f"MobileSessionManager(platform={self.platform}, status={status})"
