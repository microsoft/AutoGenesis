"""
Session Manager for Desktop Mac Skill.
Manages Appium Mac2 driver sessions for macOS desktop automation.
"""

import logging
import subprocess
import threading
from typing import Any, Dict, List, Optional

from appium import webdriver
from appium.options.mac import Mac2Options

from core.utils.logger import get_mcp_logger


logger = get_mcp_logger()


class MacSessionManager:
    """
    Manages Appium Mac2 driver sessions for macOS desktop testing.

    Responsibilities:
    - Create and manage Mac2 driver sessions
    - Handle app launch/close operations
    - Track code generation cache
    - Provide session validation
    """

    def __init__(self, driver_configs: Dict[str, Any]):
        """
        Initialize the session manager.

        Args:
            driver_configs: Platform-specific driver configurations
        """
        if "mac" not in driver_configs:
            raise ValueError("Mac configuration not found in driver_configs")

        self.config = driver_configs["mac"]
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
        Launch the Mac application.

        Args:
            kill_existing: If 1, close existing app first
            arguments: Optional command line arguments

        Returns:
            The Appium driver instance
        """
        if kill_existing == 1:
            self.app_close()

        # For Mac, always close existing session before new one
        if self._driver and self._is_session_valid():
            logger.info("Mac platform: closing existing session before new session")
            self.session_close()

        try:
            server_url = self.server_url
            logger.info(f"Connecting to Appium server at: {server_url}")

            config_copy = self.config.copy()

            if arguments is not None:
                config_copy["arguments"] = arguments
                logger.info(f"Using custom arguments: {arguments}")

            logger.info(f"Using driver config: {config_copy}")

            options = Mac2Options().load_capabilities(config_copy)
            self._driver = webdriver.Remote(server_url, options=options)
            logger.info("Mac driver session created successfully")

            return self._driver

        except Exception as e:
            logger.error(f"Failed to create Mac driver session: {str(e)}")
            self._driver = None
            raise

    def app_package(self) -> Optional[str]:
        """
        Get the app bundle ID.

        Returns:
            Bundle ID
        """
        package = self.config.get("bundleId")

        if package:
            return package

        if self._driver:
            caps = self._driver.capabilities
            return caps.get("bundleId") or caps.get("appium:bundleId")

        return None

    def app_close(self) -> None:
        """Close the Mac application."""
        if self._driver and self._is_session_valid():
            package = self.app_package()
            if package:
                logger.info(f"Force killing Mac app: {package}")
                self._force_kill_mac_app(package)
        else:
            logger.warning("No app to close or driver session is invalid.")

    def _force_kill_mac_app(self, package: str) -> None:
        """
        Force kill a Mac app by bundle ID using osascript and kill -9.

        Args:
            package: Bundle ID of the app to kill
        """
        try:
            logger.info(f"Force killing {package} using osascript/kill")
            cmd = [
                'osascript', '-e',
                f'tell application "System Events" to unix id of processes whose bundle identifier is "{package}"'
            ]
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

    def session_close(self) -> None:
        """Close the driver session."""
        if self._driver and self._is_session_valid():
            logger.info("Closing Mac driver session")
            package = self.app_package()

            def quit_driver():
                try:
                    if self._driver:
                        self._driver.quit()
                except Exception as e:
                    logger.warning(f"Error during driver quit: {e}")

            quit_thread = threading.Thread(target=quit_driver)
            quit_thread.start()
            quit_thread.join(timeout=5)

            if quit_thread.is_alive():
                logger.warning("Driver quit timed out, forcing app kill")
                if package:
                    self._force_kill_mac_app(package)

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

    @property
    def driver(self) -> Optional[webdriver.Remote]:
        """Get the current driver instance."""
        return self._driver

    def __repr__(self) -> str:
        status = "connected" if self._is_session_valid() else "disconnected"
        return f"MacSessionManager(status={status})"
