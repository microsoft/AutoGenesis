"""
Common tools for Desktop Windows Skill.
Provides core automation tools for Windows desktop applications.
"""

import asyncio
import json
import logging
import os
from typing import Any

from core.utils.response_format import format_tool_response, init_tool_response
from core.utils.logger import log_tool_call
from core.bdd.gen_code import record_calls
from skills.desktop_windows_skill.element_utils import fill_snapshot, find_element_by_kwargs


logger = logging.getLogger(__name__)


def register_common_tools(mcp: Any, session_manager: Any) -> None:
    """
    Register common tools to MCP server.

    Args:
        mcp: FastMCP server instance
        session_manager: Windows session manager
    """

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def app_launch(
        caller: str,
        scenario: str = "",
        step: str = "",
        step_raw: str = "",
        need_snapshot: int = 1
    ) -> str:
        """
        Launches the Windows application.

        Args:
            caller: Identifier of the calling module/function
            scenario: Test scenario name (for logging)
            step: Current test step description (for logging)
            step_raw: Raw original step text
            need_snapshot: Whether to include UI snapshot (1=yes, 0=no)

        Returns:
            JSON response with app snapshot data and status information
        """
        resp = init_tool_response()
        try:
            await session_manager.app_launch()
            resp["status"] = "success"
            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error launching app: {e}")
        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def app_screenshot(
        caller: str,
        path: str = "screenshots/screenshot.png",
        scenario: str = "",
        step_raw: str = "",
        step: str = ""
    ) -> str:
        """
        Takes a screenshot of the current app main window.

        Args:
            caller: Identifier of the calling module/function
            path: File path to save the screenshot
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description

        Returns:
            JSON response with status and error information
        """
        resp = init_tool_response()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            main_window = await session_manager.get_main_window()
            if main_window is None:
                raise RuntimeError("Main window not found, cannot take screenshot.")
            img = main_window.capture_as_image()
            if img is None:
                raise RuntimeError("capture_as_image() returned None. Is Pillow installed?")
            img.save(path)
            resp["data"] = {"path": path, "step_raw": step_raw}
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error taking app screenshot: {e}")
        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def app_close(
        caller: str,
        scenario: str = "",
        step_raw: str = "",
        step: str = ""
    ) -> str:
        """
        Closes the Windows application.

        Args:
            caller: Identifier of the calling module/function
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description

        Returns:
            JSON response with status information
        """
        resp = init_tool_response()
        try:
            await session_manager.app_close()
            resp["data"] = {"step_raw": step_raw}
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error closing app: {repr(e)}")
        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
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
        need_snapshot: int = 1
    ) -> str:
        """
        Clicks on a native UI element.

        Args:
            caller: Identifier of the calling module/function
            control_framework: Automation framework ('pywinauto')
            name: The exact title/name of the control
            control_type: The type/role of control
            automation_id: The exact automation_id of the control
            control_idx: Element index (1-based) when multiple elements match
            class_name: The exact class name of the control
            parent_name: The exact title/name of the parent control
            parent_control_type: The type/role of the parent control
            parent_automation_id: The exact automation_id of the parent control
            main_window_type: Type of the main window
            click_count: Number of clicks (1=single, 2=double)
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            timeout: Search timeout in seconds
            need_snapshot: Whether to include UI snapshot

        Returns:
            JSON response with status and snapshot
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
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
                        raise ValueError(f"Unsupported click_count: {click_count}")
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    resp["data"]["search_kwargs"] = search_kwargs
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"element_click not implemented for '{control_framework}'")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error clicking element '{name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
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
        need_snapshot: int = 1
    ) -> str:
        """
        Right clicks on a native UI element.

        Args:
            caller: Identifier of the calling module/function
            control_framework: Automation framework ('pywinauto')
            name: The exact title/name of the control
            control_type: The type/role of control
            automation_id: The exact automation_id
            control_idx: Element index (1-based)
            class_name: The exact class name
            parent_name: Parent control name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            main_window_type: Type of main window
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            timeout: Search timeout
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with status
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
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
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"right_click not implemented for '{control_framework}'")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error right clicking '{name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def send_keystrokes(
        caller: str,
        key_sequence_raw: str,
        key_sequence_formatted: str,
        step_raw: str = "",
        step: str = "",
        scenario: str = "",
        need_snapshot: int = 1
    ) -> str:
        """
        Sends keystrokes to the active window.

        Args:
            caller: Identifier of the calling module
            key_sequence_raw: Human-readable keystroke sequence (e.g., 'Ctrl+Shift+.')
            key_sequence_formatted: pywinauto type_keys format (e.g., '^+.')
            step_raw: Raw BDD step text
            step: Current test step description
            scenario: Scenario name
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with status
        """
        resp = init_tool_response()
        try:
            dlg = await session_manager.get_main_window()
            dlg.type_keys(key_sequence_formatted)
            await asyncio.sleep(2)
            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error sending keystrokes '{key_sequence_raw}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def enter_text(
        caller: str,
        control_framework: str,
        title: str,
        content: str,
        control_type: str,
        automation_id: str,
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
        timeout: int = 5,
        need_snapshot: int = 1
    ) -> str:
        """
        Enters text into an editable field.

        Args:
            caller: Identifier of the calling module/function
            control_framework: Automation framework ('pywinauto')
            title: The exact title/name of the edit field
            content: The text to enter
            control_type: The type/role of control
            automation_id: The exact automation_id
            control_idx: Element index (1-based)
            class_name: The exact class name
            parent_name: Parent element name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            timeout: Search timeout
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with status
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
                    title,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )

                if exists:
                    element = element.wrapper_object()
                    element.click_input()
                    element.type_keys("^a{BACKSPACE}", with_spaces=True)
                    element.type_keys(content, with_spaces=True)
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"enter_text not implemented for '{control_framework}'")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error entering text to '{title}': {e}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
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
        step_raw: str = "",
        step: str = "",
        timeout: int = 5,
        need_snapshot: int = 1
    ) -> str:
        """
        Open/expand a folder or TreeItem.

        Args:
            caller: Identifier of the calling module/function
            control_framework: Automation framework ('pywinauto')
            name: The exact title/name of the control
            control_type: The type/role of control
            automation_id: The exact automation_id
            control_idx: Element index (1-based)
            class_name: The exact class name
            parent_name: Parent element name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            timeout: Search timeout
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with status
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
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
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"open_folder not implemented for '{control_framework}'")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error opening folder '{name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
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
        step_raw: str = "",
        step: str = "",
        timeout: int = 5,
        need_snapshot: int = 1
    ) -> str:
        """
        Select an item from a list, menu, or tree.

        Args:
            caller: Identifier of the calling module/function
            control_framework: Automation framework ('pywinauto')
            name: Text/name of the item to select
            control_type: Control type (ListItem, MenuItem, TreeItem)
            automation_id: The exact automation_id
            control_idx: Element index (1-based)
            class_name: Class name
            parent_name: Parent control name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            timeout: Search timeout
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with status
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
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
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"select_item not implemented for '{control_framework}'")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error selecting item '{name}': {repr(e)}")

        return format_tool_response(resp)
