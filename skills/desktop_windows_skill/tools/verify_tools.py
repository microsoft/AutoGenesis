"""
Verify tools for Desktop Windows Skill.
Provides verification and validation tools for Windows desktop applications.
"""

import logging
import time
from typing import Any, List

from core.utils.response_format import format_tool_response, init_tool_response
from core.utils.logger import log_tool_call
from core.bdd.gen_code import record_calls
from core.llm.chat import LLMClient
from skills.desktop_windows_skill.element_utils import fill_snapshot, find_element_by_kwargs


logger = logging.getLogger(__name__)


def register_verify_tools(mcp: Any, session_manager: Any) -> None:
    """
    Register verify tools to MCP server.

    Args:
        mcp: FastMCP server instance
        session_manager: Windows session manager
    """

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def verify_element_exists(
        caller: str,
        control_framework: str,
        element_name: str,
        control_type: str,
        automation_id: str = "",
        class_name: str = "",
        control_idx: int = 1,
        parent_element_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        main_window_type: str = "",
        timeout: int = 5,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
        need_snapshot: int = 1,
    ) -> str:
        """
        Verify if an element exists/appears.

        Args:
            caller: Identifier of the calling module
            control_framework: Automation framework ('pywinauto')
            element_name: Title of the control to search for
            control_type: The type/role of control
            automation_id: Optional automation ID
            class_name: Optional class name
            control_idx: Element index (1-based)
            parent_element_name: Parent element name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            main_window_type: Type of main window
            timeout: Maximum wait time in seconds
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with verification result
        """
        resp = init_tool_response()
        try:
            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)

            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
                    element_name,
                    control_type,
                    automation_id=automation_id,
                    class_name=class_name,
                    control_idx=control_idx,
                    parent_name=parent_element_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                    main_window_type=main_window_type,
                )

                if exists:
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"Not implemented for {control_framework}")

        except Exception as e:
            # Handle ElementAmbiguousError as success (element exists but multiple found)
            if "ElementAmbiguousError" in str(type(e).__name__):
                resp["status"] = "success"
                resp["info"] = str(e)
            else:
                resp["status"] = "error"
                resp["error"] = repr(e)
                logger.error(f"Error in verify_element_exists for '{element_name}': {e}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def verify_element_not_exist(
        caller: str,
        control_framework: str,
        element_name: str,
        control_type: str,
        automation_id: str = "",
        class_name: str = "",
        parent_element_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        timeout: int = 5,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
        need_snapshot: int = 1,
    ) -> str:
        """
        Verify if an element disappears or does not exist.

        Args:
            caller: Identifier of the calling module
            control_framework: Automation framework ('pywinauto')
            element_name: Title of the control
            control_type: The type/role of control
            automation_id: Optional automation ID
            class_name: Optional class name
            parent_element_name: Parent element name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            timeout: Maximum wait time
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with verification result
        """
        resp = init_tool_response()
        try:
            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)

            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
                    element_name,
                    control_type,
                    automation_id=automation_id,
                    class_name=class_name,
                    parent_name=parent_element_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                    search_type="fuzzy",
                )

                if not exists:
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] still exists."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"Not implemented for {control_framework}")

        except TimeoutError:
            resp["status"] = "success"
            resp["info"] = f"Element '{element_name}' not found within {timeout} seconds, as expected."
        except Exception as e:
            if "ElementAmbiguousError" in str(type(e).__name__):
                resp["status"] = "failed"
                resp["info"] = repr(e)
            else:
                resp["status"] = "error"
                resp["error"] = repr(e)
                logger.error(f"Error in verify_element_not_exist for '{element_name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def verify_checkbox_state(
        caller: str,
        control_framework: str,
        name: str,
        expected_state: str,
        control_type: str,
        automation_id: str = "",
        control_idx: int = 1,
        class_name: str = "",
        parent_name: str = "",
        parent_automation_id: str = "",
        parent_control_type: str = "",
        timeout: int = 5,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
        need_snapshot: int = 1,
    ) -> str:
        """
        Verify if a checkbox is checked or unchecked.

        Args:
            caller: Identifier of the calling module
            control_framework: Automation framework ('pywinauto')
            name: Name of the checkbox
            expected_state: Expected state ('checked' or 'unchecked')
            control_type: Control type
            automation_id: Optional automation ID
            control_idx: Element index (1-based)
            class_name: Optional class name
            parent_name: Parent element name
            parent_automation_id: Parent automation ID
            parent_control_type: Parent control type
            timeout: Maximum wait time
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with verification result
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
                    if control_type == "RadioButton":
                        is_checked = element.is_selected() == 1
                    else:
                        is_checked = element.get_toggle_state() == 1
                    actual_state = "checked" if is_checked else "unchecked"
                    if expected_state.lower() == actual_state:
                        resp["status"] = "success"
                        resp["data"]["actual_state"] = actual_state
                    else:
                        resp["status"] = "failed"
                        resp["error"] = f"Checkbox state mismatch. Expected: '{expected_state}', Actual: '{actual_state}'"
                        logger.error(resp["error"])
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"Not implemented for {control_framework}")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_checkbox_state for '{name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def verify_element_value(
        caller: str,
        control_framework: str,
        element_name: str,
        element_value: str,
        control_type: str,
        expected_value: str,
        automation_id: str = "",
        control_idx: int = 1,
        class_name: str = "",
        parent_element_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        step_raw: str = "",
        step: str = "",
        scenario: str = "",
        timeout: int = 5,
        need_snapshot: int = 1,
    ) -> str:
        """
        Verify that an element contains the expected value.

        Args:
            caller: Identifier of the calling module
            control_framework: Automation framework ('pywinauto')
            element_name: Name of the element
            element_value: Current value from snapshot
            control_type: Control type
            expected_value: Expected value to verify
            automation_id: Optional automation ID
            control_idx: Element index (1-based)
            class_name: Optional class name
            parent_element_name: Parent element name
            parent_control_type: Parent control type
            parent_automation_id: Parent automation ID
            step_raw: Raw original step text
            step: Current test step description
            scenario: Test scenario name
            timeout: Maximum wait time
            need_snapshot: Include UI snapshot

        Returns:
            JSON response with verification result
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    session_manager,
                    element_name,
                    control_type,
                    automation_id=automation_id,
                    control_idx=control_idx,
                    class_name=class_name,
                    parent_name=parent_element_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )

                if exists:
                    actual_value = element.get_value()
                    if expected_value in actual_value:
                        resp["status"] = "success"
                    else:
                        resp["status"] = "failed"
                        resp["error"] = f"Value mismatch. Expected: '{expected_value}', Actual: '{actual_value}'"
                        logger.error(resp["error"])
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] not found within {timeout} seconds."
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(f"Not implemented for {control_framework}")

            await fill_snapshot(resp, session_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_element_value for '{expected_value}': {e}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(session_manager)
    async def verify_visual_task(
        caller: str,
        screenshot_path: str,
        task_description: str,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
    ) -> str:
        """
        Read and analyze a screenshot, verify if visual content matches the task description.

        Args:
            caller: Calling module/function identifier
            screenshot_path: Path to the screenshot image file
            task_description: Task to verify against the screenshot
            scenario: Test scenario name
            step_raw: Raw step text
            step: Current step description

        Returns:
            JSON response with status, verification result, and reason
        """
        resp = init_tool_response()
        try:
            if not screenshot_path.lower().endswith(".png"):
                raise ValueError("Only PNG format screenshots are supported.")

            with open(screenshot_path, "rb") as f:
                image_data = f.read()

            client = LLMClient()
            result = client.evaluate_task(task_info=task_description, image_data=image_data)

            resp["status"] = "success" if result.result else "error"
            resp["data"] = {
                "result": result.result,
                "reason": result.reason,
                "step_raw": step_raw,
            }
            if resp["status"] == "error":
                resp["error"] = result.reason
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_visual_task: {e}")

        return format_tool_response(resp)
