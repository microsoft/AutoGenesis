import logging
import time
from utils.element_util import fill_snapshot, find_element_by_kwargs
from utils.logger import log_tool_call
from utils.response_format import format_tool_response, init_tool_response
from utils.gen_code import record_calls
from llm.chat import LLMClient
import io
from pywinauto.findwindows import ElementAmbiguousError


logger = logging.getLogger(__name__)


def register_verify_tools(mcp, app_manager):
    """Register verify tools to MCP server."""

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
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
        Verify/check if an element exists/appears

        Args:
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            element_name: title of the control to search for.
            control_type: The type/role of control, **MUST be extracted from the UI snapshot/element information, do NOT assume based on content type**.
            automation_id: Optional automation ID of the element
            class_name: Optional class name of the element, extract from the class_name.
            control_idx: Element index to select when multiple elements match (1-based).
                Default value 1.
            parent_element_name: The exact title/name of the parent element
            parent_control_type: The type/role of the parent control
            parent_automation_id: The exact automation_id of the parent control
            main_window_type: Type of the main window. Default to "".
                 Available options:
                - 'screenshot_cn': Use the CN screenshot window.
            timeout: Maximum time in seconds to wait for the element
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
        """
        resp = init_tool_response()
        try:
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)

            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
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
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    logger.error(f"{resp['error']}: {search_kwargs}")
            else:
                raise NotImplementedError(f"Not implemented for {control_framework} framework.")

            # await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except ElementAmbiguousError as e:
            resp["status"] = "success"
            resp["info"] = f"{str(e)}"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_element_exists for '{element_name}': {e}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
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
        Verify/check if an element disappears or does not exist

        Args:
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            element_name: title of the control to search for.
            control_type: The type/role of control, **MUST be extracted from the UI snapshot/element information, do NOT assume based on content type**.
            automation_id: Optional automation ID of the element
            class_name: Optional class name of the element, extract from the class_name.
            timeout: Maximum time in seconds to wait for the element
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
        """

        resp = init_tool_response()
        try:
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)

            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
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
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] found."
                    logger.error(f"{resp['error']}: {search_kwargs}")
            else:
                raise NotImplementedError(f"Not implemented for {control_framework} framework.")

            # await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except ElementAmbiguousError as e:
            resp["status"] = "failed"
            resp["info"] = f"{repr(e)}"
        except TimeoutError:
            resp["status"] = "success"
            resp["info"] = f"Element '{element_name}' not found within {timeout} seconds, as expected."
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_element_not_exist for '{element_name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
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
        Verifies if a checkbox is checked or unchecked.

        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: Name or title of the checkbox to verify
            expected_state: The expected state: "checked" or "unchecked"
            control_type: Control type, defaults to "CheckBox"
            automation_id: Optional automation ID of the checkbox
            control_idx: Element index to select when multiple elements match (1-based).
                Default value 1.
            class_name: Optional class name of the element, extract from the class_name.
            parent_name: The exact title/name of the parent element
            parent_control_type: Control type of the parent element
            parent_automation_id: Optional automation ID of the parent element
            timeout: Maximum time in seconds to wait for the checkbox
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description

        Returns:
            JSON response with verification result and status information
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
                    # Get the toggle state
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
                    logger.error(resp['error'])
            else:
                raise NotImplementedError(f"Not implemented for {control_framework} framework.")

            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_checkbox_state for '{name}': {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
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
        Verifies that an control contains the expected value/content.

        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            element_name: Name or title of the element to search for
            element_value: value of the control, extract from the element value
            control_type: Optional control type for more specific search (Edit, Button, etc.)
            expected_value: The expected value to verify, only extract from the step content, do not extract from the element value
            automation_id: Optional automation ID of the element
            control_idx: Element index to select when multiple elements match (1-based).
                Default value 1.
            class_name: Optional class name of the element, extract from the class_name.
            parent_element_name: The exact title/name of the parent element
            parent_control_type: Optional control type of the parent element
            parent_automation_id: Optional automation ID of the parent element
            step_raw: Raw original step text
            step: Current test step description
            scenario: Test scenario name
            timeout: Maximum time in seconds to wait for the element


        Returns:
            JSON response with verification result and status information
        """

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                    app_manager,
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
                        resp["error"] = f"Element value mismatch. Expected: '{expected_value}', Actual: '{actual_value}'"
                        logger.error(resp["error"])
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    logger.error(f"{resp['error']}: {search_kwargs}")
            else:
                raise NotImplementedError(f"Not implemented for {control_framework} framework.")

            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_element_value for '{expected_value}': {e}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def verify_elements_order(
        caller: str,
        control_framework: str,
        control_names: list[str],
        control_type: str,
        automation_id: str = "",
        control_idx: int = 1,
        class_name: str = "",
        control_orders: list[int] = [],
        step_raw: str = "",
        step: str = "",
        scenario: str = "",
        timeout: int = 5,
        need_snapshot: int = 1,
    ) -> str:
        """
        Verifies that controls appear in the specified order (vertically or horizontally).

        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            control_names: List of control names in the expected order
            control_type: Optional control type for more specific search (TreeItem, Button, etc.)
            automation_id: Optional automation ID of the element
            control_idx: Element index to select when multiple elements match (1-based).
                Default value 1.
            class_name: Optional class name of the element, extract from the class_name.
            control_orders: Optional list of integers representing custom ordering indices for controls.
                When provided, these indices will be used to verify the order instead of positional comparison.
                The length should match control_names if specified.
            step_raw: Raw original step text
            step: Current test step description
            scenario: Test scenario name
            timeout: Maximum time in seconds to wait for the elements
            need_snapshot: Whether to include UI snapshot in response

        Returns:
            JSON response with verification result and status information
        """
        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                siblings = None
                elements_real_order = []
                elsements = []

                for name in control_names:
                    time_s = time.time()

                    element, exists, search_kwargs, parent_search_kwargs = await find_element_by_kwargs(
                        app_manager,
                        name,
                        control_type,
                        automation_id=automation_id,
                        control_idx=control_idx,
                        class_name=class_name,
                        timeout=timeout,
                    )
                    if exists:
                        elsements.append(element.element_info)
                        logger.info(f"Element [{search_kwargs}] found, search cost: {time.time() - time_s:.3f}s")
                        if siblings is None:
                            siblings = element.element_info.parent.children()
                            logger.info(f"Finding siblings for element '{name}', total siblings: {len(siblings)}, search cost: {time.time() - time_s:.3f}s")
                    else:
                        raise Exception(f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds.")

                for element_info in elsements:
                    elements_real_order.append(siblings.index(element_info) + 1)
                    
                expected_orders = control_orders if control_orders else sorted(elements_real_order)
                is_sorted = elements_real_order == expected_orders

                if is_sorted:
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"Elements are not in the expected order. Expected: {expected_orders}, Actual: {elements_real_order}"
                    logger.error(resp["error"])
            else:
                raise NotImplementedError(
                    f"{control_framework} framework does not support order verification directly. Please use pywinauto for this operation."
                )

            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logger.error(f"Error in verify_elements_order: {repr(e)}")

        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def verify_visual_task(
        caller: str,
        screenshot_path: str,
        task_description: str,
        scenario: str = "",
        step_raw: str = "",
        step: str = "",
    ) -> str:
        """
        Read and analyze a screenshot, verify if the visual content matches the task description.

        Combines screenshot reading and visual analysis to verify UI content automatically.
        Ideal for visual verification in automated testing scenarios.

        Args:
            caller (str): Calling module/function identifier
            screenshot_path (str): Path to the screenshot image file
            task_description (str): Task to verify against the screenshot
            scenario (str): Test scenario name
            step_raw (str): Raw step text
            step (str): Current step description

        Returns:
            str: JSON response with status, verification result, reason, and error (if any)

        """
        resp = init_tool_response()
        try:
            # Read the png formate screenshot from the provided path
            if not screenshot_path.lower().endswith(".png"):
                raise ValueError("Only PNG format screenshots are supported.")
            
            with open(screenshot_path, "rb") as f:
                image_data = f.read()

            # Initialize LLMClient
            client = LLMClient()

            # Call evaluate_task
            result = client.evaluate_task(task_info=task_description, image_data=image_data)

            # Populate response
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
