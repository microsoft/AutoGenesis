"""
Session Manager for Desktop Windows Skill.
Manages pywinauto application sessions for Windows desktop automation.
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional

import psutil


logger = logging.getLogger(__name__)


class WindowsSessionManager:
    """
    Manages pywinauto application sessions for Windows desktop testing.

    Responsibilities:
    - Create and manage pywinauto application sessions
    - Handle app launch/close operations
    - Track code generation cache
    - Provide window finding utilities
    """

    def __init__(self, app_conf: Dict[str, Any]):
        """
        Initialize the session manager.

        Args:
            app_conf: Application configuration dictionary
        """
        self.config = app_conf.copy()
        self.launch_args: List[str] = self.config.get("launch_args", []).copy()

        self.app_name: str = self.config.get("app_name", "")
        self._app: Any = None  # pywinauto Application instance

        self.gen_code_id: Optional[str] = None
        self.gen_code_cache: List[Dict[str, Any]] = []
        self.proposed_changes: Optional[str] = None
        self.header_code: str = ""
        self.steps_dir: Optional[str] = None
        self.step_file_target: Optional[str] = None

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

    async def _new_launch(self, args: List[str]) -> None:
        """
        Launch a new application instance.

        Args:
            args: Command line arguments for the application
        """
        from pywinauto import Application

        self.kill_app_process_by_path()

        valid_exe_path = self.config["exe"]
        time_s = time.time()
        launch_success = False

        cmd = f"{valid_exe_path}"
        if args:
            cmd += " " + " ".join(args)
        logger.info(f"[WindowsSessionManager] Launching {self.app_name}: {cmd}")

        Application(backend="uia").start(cmd)

        for i in range(5):
            time.sleep(2)
            try:
                self._app = Application(backend="uia").connect(
                    title_re=self.config["window_title_re"]
                )
                main_window = self._app.window(
                    title_re=self.config["window_title_re"],
                    control_type="Window"
                )
                main_window.wait("exists", timeout=1)
                logger.info(f"[WindowsSessionManager] Launch exists done")
                main_window.wait("visible", timeout=1)
                logger.info(f"[WindowsSessionManager] Launch visible done")
                main_window.wait("enabled", timeout=1)
                logger.info(
                    f"[WindowsSessionManager] Launch done, cost: {time.time() - time_s:.3f} seconds"
                )
                launch_success = True
                break
            except Exception as e:
                logger.error(f"[WindowsSessionManager] Launch attempt {i} error: {repr(e)}")

        if launch_success:
            self._app = Application(backend="uia").connect(
                title_re=self.config["window_title_re"]
            )
            return

        raise RuntimeError(
            f"[WindowsSessionManager] Failed to launch {self.app_name}. "
            "Please check the app executable path and arguments."
        )

    async def app_launch(self, kill_existing: int = 0) -> bool:
        """
        Launch the application.

        Args:
            kill_existing: If 1, close existing app first

        Returns:
            True if a new launch was performed
        """
        from pywinauto import Application
        from pywinauto.findwindows import ElementNotFoundError

        if kill_existing == 1:
            await self.app_close()

        args = self.launch_args.copy()
        is_new_launch = False

        try:
            if self._app:
                self._app = Application(backend="uia").connect(
                    title_re=self.config["window_title_re"]
                )
            else:
                await self._new_launch(args=args)
                is_new_launch = True
        except ElementNotFoundError as e:
            logger.error(f"[WindowsSessionManager] Error connecting: {repr(e)}")
            await self._new_launch(args=args)
            is_new_launch = True
        except Exception as e:
            logger.error(f"[WindowsSessionManager] Error connecting: {repr(e)}")
            raise e

        return is_new_launch

    async def app_close(self) -> None:
        """Close the application."""
        if self._app:
            try:
                main_window = await self.get_main_window()
                main_window.close()
                self._app.kill()
                self._app = None
            except Exception as e:
                logger.error(f"[WindowsSessionManager] Error closing app: {repr(e)}")
        else:
            logger.info("No app session to close.")

        self.kill_app_process_by_path()

    def kill_app_process_by_path(self) -> None:
        """Kill any running instances of the application by executable path."""
        exe_path = os.path.normcase(os.path.normpath(self.config["exe"]))
        killed = False

        for proc in psutil.process_iter(["pid", "name", "exe"]):
            try:
                proc_exe = proc.info["exe"]
                if proc_exe and os.path.normcase(os.path.normpath(proc_exe)) == exe_path:
                    logger.info(f"Killing existing app process: PID={proc.pid}, Exe={proc_exe}")
                    proc.kill()
                    killed = True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            except Exception as e:
                logger.error(f"Error checking/killing process: {repr(e)}")
                continue

        if killed:
            time.sleep(2)
        else:
            logger.info("No existing app process found to kill.")

    async def get_main_window(self, main_window_type: str = "") -> Any:
        """
        Get the main application window.

        Args:
            main_window_type: Type of window to find

        Returns:
            The main window wrapper
        """
        if not self._app:
            await self.app_launch()

        main_window = self._app.window(
            title_re=self.config["window_title_re"],
            control_type="Window"
        )

        if not main_window.exists(timeout=1):
            self._app = None
            logger.error(f"Main window with title '{self.config['window_title_re']}' not found.")
            raise RuntimeError(
                f"Main window with title '{self.config['window_title_re']}' not found."
            )

        return main_window

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

    def clear_gen_code_cache(self) -> None:
        """Clear the code generation cache."""
        self.gen_code_cache.clear()
        self.gen_code_id = None
        self.proposed_changes = None
        self.header_code = ""
        self.steps_dir = None
        self.step_file_target = None

    @property
    def app(self) -> Any:
        """Get the current pywinauto Application instance."""
        return self._app

    def __repr__(self) -> str:
        status = "connected" if self._app else "disconnected"
        return f"WindowsSessionManager(app={self.app_name}, status={status})"
