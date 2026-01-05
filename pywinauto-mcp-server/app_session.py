# tools/app_manager.py

import os
import psutil
import time
import logging
import shutil
import tempfile
import uuid
import json
from pathlib import Path
from datetime import datetime
from pywinauto import Application, Desktop
from pywinauto.controls.uiawrapper import UIAWrapper
from playwright.async_api import async_playwright
from pywinauto.findwindows import ElementNotFoundError


logger = logging.getLogger(__name__)
            
class AppSessionManager:
    def __init__(self, app_conf: dict):
        self.config = app_conf.copy()
        self.launch_args = self.config.get('launch_args', []).copy()

        self.app_name = self.config.get('app_name', "")
        self._app = None  # Application instance

        self.gen_code_id = None
        self.gen_code_cache = []
        self.proposed_changes = None  # Store proposed code changes
        self.header_code = ""
        self.steps_dir = None  # Directory for step files
        self.step_file_target = None  # Target step file for code generation

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

    async def _new_launch(self, args: list[str]):
        self.kill_app_process_by_path()

        valid_exe_path = self.config["exe"]
        time_s = time.time()
        launch_success = False

        cmd = f"{valid_exe_path}"
        if args:
            cmd += " " + " ".join(args)
        logger.info(f"[AppManager] Launching new {self.app_name}: {cmd}")
        # Start the app application using pywinauto
        Application(backend="uia").start(cmd)
        for i in range(5):
            time.sleep(2)
            try:
                self._app = Application(backend="uia").connect(title_re=self.config["window_title_re"])
                main_window = self._app.window(title_re=self.config["window_title_re"], control_type="Window")
                main_window.wait("exists", timeout=1)
                logger.info(f"[AppManager] Launching new {self.app_name} using pywinauto: exists done")
                main_window.wait("visible", timeout=1)
                logger.info(f"[AppManager] Launching new {self.app_name} using pywinauto: visible done")
                main_window.wait("enabled", timeout=1)
                logger.info(f"[AppManager] Launching new {self.app_name} using pywinauto: done, cost: {time.time() - time_s:.3f} seconds")
                launch_success = True
                break
            except Exception as e:
                logger.error(f"[AppManager] Launching new {self.app_name} the {i} time error: {repr(e)}")
        
        if launch_success:
            self._app = Application(backend="uia").connect(title_re=self.config["window_title_re"])
            return
        
        raise RuntimeError(f"[AppManager] Failed to launch {self.app_name}. Please check the app executable path and arguments.")

    async def app_launch(
            self, 
            kill_existing: int = 0, 
            ):
            
        if kill_existing == 1:
            await self.app_close()

        args = self.launch_args.copy()
        is_new_launch = False
        try:
            if self._app:
                self._app = Application(backend="uia").connect(title_re=self.config["window_title_re"])
            else:
                await self._new_launch(args=args)
                is_new_launch = True
        except ElementNotFoundError as e:
            logger.error(f"[AppManager] Error connecting to existing app: {repr(e)}")
            await self._new_launch(args=args)
            is_new_launch = True
        except Exception as e:
            logger.error(f"[AppManager] Error connecting to existing app: {repr(e)}")
            raise e

        return is_new_launch
    

    async def app_close(self):
        if self._app:
            try:
                main_window = await self.get_main_window()
                main_window.close()
                self._app.kill()
                self._app = None
            except Exception as e:
                logger.error(f"[AppManager] Error closing app application: {repr(e)}")

        else:
            logger.info("No app session to close.")

        self.kill_app_process_by_path()

    def kill_app_process_by_path(self):
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
                logger.error(f"Error checking/killing process {proc.pid} {proc_exe}: {repr(e)}")
                continue

        if killed:
            time.sleep(2)
        else:
            logger.info("No existing app process found to kill.")

    async def get_main_window(self, main_window_type: str = ""):
        if main_window_type == "screenshot_cn":
            return self.get_screenshot_window()
        
        if not self._app:
            await self.app_launch()     
           
        main_window = self._app.window(title_re=self.config["window_title_re"], control_type="Window")
        if not main_window.exists(timeout=1):
            self._app = None
            logger.error(f"Main window with title '{self.config['window_title_re']}' not found.")
            raise RuntimeError(f"Main window with title '{self.config['window_title_re']}' not found.")
        
        return main_window
    
    
    def get_screenshot_window(self):
        if not self._app:
            logger.error(f"No app application instance found. Please launch the app first.")
            raise RuntimeError("No app application instance found. Please launch the app first.")     
        
        screenshot_window = self._app.window(
            title="",
            control_type="Pane",
            class_name="Chrome_WidgetWin_1",
            found_index=0
        )
        exists = screenshot_window.exists(timeout=5)
        if exists:
            return screenshot_window
        
        logger.error("No screenshot window found.")
        return None

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
            pass

    def clear_gen_code_cache(self):
        self.gen_code_cache.clear()
        self.gen_code_id = None
        self.proposed_changes = None
        self.header_code = ""
        self.steps_dir = None
        self.step_file_target = None
