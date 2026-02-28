# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import json
import os
import logging
import sys
import time
import inspect
import asyncio
from utils.element_util import fill_snapshot, find_element_by_kwargs
from utils.logger import log_tool_call
from utils.response_format import format_tool_response, init_tool_response
from utils.gen_code import record_calls

        
logger = logging.getLogger(__name__)

def register_common_tools(mcp, app_manager):
    """Register app tools to MCP server."""   
    
    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def app_launch(
        caller: str, 
        scenario: str = "", 
        step: str = "", 
        step_raw: str = "",
        need_snapshot: int = 1) -> str:
        """
        Launches the app.
        
        Args:
            caller: Identifier of the calling module/function
            scenario: Test scenario name (for logging)
            step: Current test step description (for logging)
            step_raw: Raw original step text
            
        Returns:
            JSON response with app snapshot data and status information
        """
        resp = init_tool_response()        
        try:
            await app_manager.app_launch()
            resp["status"] = "success"
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error launching app: {e}")
        return format_tool_response(resp)
    
    
    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def app_screenshot(caller: str, path: str = "screenshots/screenshot.png", scenario: str = "", step_raw: str = "", step: str = "") -> str:
        """
        Takes a screenshot of the current app main window and saves it as a PNG file.

        Args:
            caller: Identifier of the calling module/function
            path: File path to save the screenshot (default: screenshots/screenshot.png)
            scenario: Test scenario name (for logging)
            step_raw: Raw original step text
            step: Current test step description

        Returns:
            JSON response with status and error information
        """
        resp = init_tool_response()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            main_window = await app_manager.get_main_window()
            if main_window is None:
                raise RuntimeError("Main window not found, cannot take screenshot.")
            img = main_window.capture_as_image()
            if img is None:
                raise RuntimeError("capture_as_image() returned None. Is Pillow installed?")
            img.save(path)
            resp["data"] = {"path": path, "step_raw": step_raw}

            resp["status"] = "success"
            print(f"Screenshot saved to {path}")
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error taking app screenshot: {e}")
            print(f"Error taking screenshot: {e}")
        return format_tool_response(resp)


    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def app_close(caller: str, scenario: str = "", step_raw: str = "", step: str = "") -> str:
        """
        Closes the app instance that was previously launched.
        
        Args:
            caller: Identifier of the calling module/function
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            
        Returns:
            JSON response with status information about the app closure
        """
        resp = init_tool_response()
        try:
            await app_manager.app_close()
            resp["data"] = {"step_raw": step_raw}
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error closing app: {repr(e)}")
                    
        return format_tool_response(resp)    

    
    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def element_click(
        caller: str, 
        control_framework: str, 
        name: str, 
        control_type: str, 
        automation_id: str = "",
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        main_window_type: str = "",
        click_count: int = 1,
        scenario: str = "", 
        step_raw: str = "", 
        step: str = "",
        timeout: int = 5, 
        need_snapshot: int = 1) -> str:
        """
        Clicks on a native button element in the app UI.
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: The exact title/name of the control 
            control_type: The type/role of control
            automation_id: The exact automation_id of the control
            control_idx: Element index to select when multiple elements match (1-based). 
                Default value 1.
            class_name: The exact class name of the control
            parent_name: The exact title/name of the parent control
            parent_control_type: The type/role of the parent control
            parent_automation_id: The exact automation_id of the parent control
            main_window_type: Type of the main window. Default to "".
                 Available options:
                - 'screenshot_cn': Use the CN screenshot window.
            click_count: Number of clicks to perform (1 for single click, 2 for double click)
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
        Returns:
            JSON response with app snapshot data and status information
        """

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
                    name,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    class_name=class_name,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                    main_window_type=main_window_type,
                )

                if exists:
                    btn = element.wrapper_object()
                    if click_count == 1:
                        btn.click_input()
                    elif click_count == 2:
                        btn.double_click_input()
                    else:
                        raise ValueError(f"Unsupported click_count: {click_count}. Supported values are 1 and 2.")
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    resp["data"]['search_kwargs'] = search_kwargs
                    logger.error(resp['error'])
            else:
                raise NotImplementedError(f"element_click is not implemented for '{control_framework}' control_framework yet.")
                
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            import traceback
            traceback.print_exc()
            logger.error(f"Error clicking button '{name}': {repr(e)}")

        logger.info(f"native_button_click done")    
        return format_tool_response(resp)    
    
    
    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def right_click(
        caller: str, 
        control_framework: str, 
        name: str, 
        control_type: str, 
        automation_id: str = "", 
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        main_window_type: str = "",
        scenario: str = "", 
        step_raw: str = "", 
        step: str = "", 
        timeout: int = 5, 
        need_snapshot: int = 1) -> str:
        """
        Right clicks on a native control element in the app UI.
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: The exact title/name of thecontrol
            content: The text to enter into the control
            control_type: The type/role of control
            automation_id: The exact automation_id of the control
            control_idx: Element index to select when multiple elements match (1-based). 
                Default value 1.
            class_name: The exact class_name of the control.
            parent_name: The exact title/name of the parent control
            parent_control_type: The type/role of the parent control
            parent_automation_id: The exact automation_id of the parent control
            main_window_type: Type of the main window. Default to "".
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description

        Returns:
            JSON response with app snapshot data and status information
        """

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
                    name,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    class_name=class_name,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                    main_window_type=main_window_type,
                )

                if exists:
                    btn = element.wrapper_object()
                    btn.right_click_input()
                    await asyncio.sleep(1)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    resp["data"]['search_kwargs'] = search_kwargs
                    logger.error(resp['error'])
            else:
                raise NotImplementedError(f"right_click is not implemented for '{control_framework}' control_framework yet.")
                
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            import traceback
            traceback.print_exc()
            logger.error(f"Error right clicking control '{name}': {repr(e)}")

        logger.info(f"native_button_click done")    
        return format_tool_response(resp)    


    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def send_keystrokes(
        caller: str, 
        key_sequence_raw: str, 
        key_sequence_formatted: str, 
        step_raw: str = '', 
        step: str = '', 
        scenario: str = '', 
        need_snapshot: int = 1) -> str:
        """
        Sends keystrokes to the active app window using pywinauto, with support for key combinations.

        Args:
            caller (str): Identifier of the calling module or context.
            key_sequence_raw (str): The original human-readable keystroke sequence (e.g., 'Ctrl+Shift+.').
            key_sequence_formatted (str): The sequence converted to pywinauto's type_keys format 
                                        (e.g., '^+.' for Ctrl+Shift+.).
            step_raw (str): The raw BDD step text from the feature file.
            step (str): The current test step description.
            scenario (str, optional): Scenario name for logging/tracking. Defaults to ''.
        Returns:
            str: JSON-formatted result with status, optional snapshot data, and any error message.
        """
        resp = init_tool_response()
        try:
            dlg = await app_manager.get_main_window()
            dlg.type_keys(key_sequence_formatted)
            await asyncio.sleep(2)
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error sending keystrokes raw:'{key_sequence_raw}' '{key_sequence_formatted}': {repr(e)}")
            
        return format_tool_response(resp)
    

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def enter_text(
        caller: str, 
        control_framework: str,        
        title: str, 
        content:str, 
        control_type: str, 
        automation_id: str, 
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        scenario: str = '',
        step_raw: str = '', 
        step: str = '', 
        timeout: int = 5, 
        need_snapshot: int = 1) -> str:
        """
        Enters text into an editable field in the app UI.
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.            
            title: The exact title/name of the edit field 
            content: The text to enter into the edit field
            control_type: The type/role of control
            automation_id: The exact automation_id of the control
            control_idx: Element index to select when multiple elements match (1-based).
                    Default value 1.
            class_name: The exact class_name of the control.
            parent_name: The exact title/name of the parent element containing the edit field
            parent_control_type: The type/role of the parent control containing the edit field
            parent_automation_id: The exact automation_id of the parent control containing the edit field
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            
        Returns:
            JSON response with status and error information
        """

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
                    title,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    class_name=class_name,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )

                if exists:
                    element = element.wrapper_object()
                    element.click_input()
                    element.type_keys('^a{BACKSPACE}', with_spaces=True)
                    element.type_keys(content, with_spaces=True)
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    resp["data"]['search_kwargs'] = search_kwargs
                    logger.error(f"{resp['error']}: search_kwargs={search_kwargs}")
            else:
                raise NotImplementedError(f"input_text is not implemented for '{control_framework}' control_framework yet.")
            
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error inputting text to edit field '{title}': {e}")
            
        return format_tool_response(resp)


    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def open_folder(
        caller: str, 
        control_framework: str, 
        name: str, 
        control_type: str, 
        automation_id: str = "", 
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        scenario: str = "", 
        step_raw: str = '', 
        step: str = '', 
        timeout: int = 5, 
        need_snapshot: int = 1) -> str:
        """
        Open/expand a folder/TreeItem
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: The exact title/name of the control
            content: The text to enter into the control
            control_type: The type/role of control to open
            automation_id: The exact automation_id of the control
            control_idx: Element index to select when multiple elements match (1-based).
                Default value 1.
            class_name: The exact class_name of the control.
            parent_name: The exact title/name of the parent element containing the control
            parent_control_type: The exact control_type of the parent element containing the control
            parent_automation_id: The exact automation_id of the parent element containing the control
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description

        """

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
                    name,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    class_name=class_name,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )

                if exists:
                    element = element.wrapper_object()
                    element.expand()
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    resp["data"]['search_kwargs'] = search_kwargs
                    logger.error(f"{resp['error']}: search_kwargs={search_kwargs}")
            else:
                raise NotImplementedError(f"open_folder is not implemented for '{control_framework}' control_framework yet.")

            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            import traceback
            traceback.print_exc()
            logger.error(f"Error clicking button '{name}': {repr(e)}")

        return format_tool_response(resp)    
    
    
    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)    
    async def select_item(
        caller: str,
        control_framework: str,
        name: str,
        control_type: str,
        automation_id: str = "",
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        scenario: str = "", 
        step_raw: str = '', 
        step: str = '', 
        timeout: int = 5, 
        need_snapshot: int = 1) -> str:
        """
        Select an item for multi-selection or single selection operations. Use this for:
        - Selecting items from dropdown lists (ListItem)
        - Selecting menu options (MenuItem) 
        - Selecting TreeItems in lists/trees for multi-selection scenarios
        - Selecting favorites, bookmarks, or other items where "select" implies choosing for bulk operations
        
        For simple clicking/activation without selection context, use element_click instead.
        
        Args:
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: Text/name of the item to select
            control_type: Control type (ListItem, MenuItem, TreeItem, etc.)
            automation_id: The exact automation_id of the control to select
            control_idx: Element index to select when multiple elements match (1-based).    
                Default value 1.
            class_name: Class name of the control
            parent_name: Title of the parent control
            parent_control_type: Control type of the parent control
            parent_automation_id: Automation ID of the parent control
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
           
        """

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                time_s = time.time()
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
                    name,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    class_name=class_name,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )

                if exists:
                    if control_type in ["ListItem", "MenuItem", "TreeItem"]:
                        element.select()
                    else:
                        element.click_input()
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    logger.error(f"{resp['error']}: search_kwargs={search_kwargs}")                  
            else:
                raise NotImplementedError(f"select_item is not implemented for '{control_framework}' control_framework yet.")

            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error finding item: name={name}, control_type={control_type}. error={repr(e)}")
                 
        return format_tool_response(resp)
    
