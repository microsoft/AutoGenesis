# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import os
import logging
import sys
import time
import inspect
import asyncio

from math import hypot
from utils.element_util import fill_snapshot, find_element_by_kwargs
from utils.logger import log_tool_call
from utils.response_format import format_tool_response, init_tool_response
from pywinauto import Application, mouse
from collections import namedtuple

from utils.gen_code import record_calls

logger = logging.getLogger(__name__)

def register_mouse_tools(mcp, app_manager):
    """Register mouse tools to MCP server."""

    Point = namedtuple("Point", "x y")

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def mouse_drag_drop(
        caller: str, 
        control_framework: str, 
        source_title: str = '',
        source_control_type: str = '',
        from_type: str = 'element',
        from_x: int = 0,
        from_y: int = 0,
        drag_type: str = 'to_element',
        target_title: str = '', 
        target_control_type: str = '',
        x_offset: int = 0,
        y_offset: int = 0,
        mouse_button: str = 'left',
        scenario: str = '', 
        step_raw: str = '', 
        step: str = '', 
        timeout: int = 5, 
        need_snapshot: int = 1) -> str:
        """
        Performs a drag and drop operation from source element to target element or by distance
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            source_title: The name/title of the source element to drag from (required when from_type='element')
            source_control_type: The type of control of source element (required when from_type='element')
            from_type: Type of source location - 'element' or 'pixel'
                - 'element': Drag from a UI element (requires source_title and source_control_type)
                - 'pixel': Drag from specific pixel coordinates (requires from_x and from_y)
            from_x: X coordinate in pixels to drag from (required when from_type='pixel')
            from_y: Y coordinate in pixels to drag from (required when from_type='pixel')
            drag_type: Type of drag operation - 'to_element' or 'by_offset'
                - 'to_element': Drag to a specific target element (requires target_title and target_control_type)
                - 'by_offset': Drag by specified pixel offsets from source location (requires x_offset and/or y_offset)
            target_title: The name/title of the target element to drop onto (required when drag_type='to_element')
            target_control_type: The type of control of target element (required when drag_type='to_element')
            x_offset: Horizontal offset in pixels from the source/target location. 
                     Positive values move right, negative values move left. Default is 0.
                     For 'by_offset': offset from source location
                     For 'to_element': offset from target element center
            y_offset: Vertical offset in pixels from the source/target location. 
                     Positive values move down, negative values move up. Default is 0.
                     For 'by_offset': offset from source location
                     For 'to_element': offset from target element center
            mouse_button: Mouse button to use for dragging - 'left' or 'right'. Default is 'left'.
            scenario: Test scenario name
            step_raw: Raw original step text
            step: Current test step description
            
        Returns:
            JSON response with status and error information
            
        """

        if from_type not in ["element", "pixel"]:
            raise ValueError(f"Unsupported from_type: {from_type}. Supported types are 'element' and 'pixel'.")
            
        if drag_type not in ["to_element", "by_offset"]:
            raise ValueError(f"Unsupported drag_type: {drag_type}. Supported types are 'to_element' and 'by_offset'.")

        # Validate parameters based on from_type
        if from_type == "element":
            if not source_title or not source_control_type:
                raise ValueError("source_title and source_control_type are required when from_type='element'.")
        elif from_type == "pixel":
            if from_x < 0 or from_y < 0:
                raise ValueError("from_x and from_y must be non-negative when from_type='pixel'.")

        # Validate parameters based on drag_type
        if drag_type == "to_element":
            if not target_title or not target_control_type:
                raise ValueError("target_title and target_control_type are required when drag_type='to_element'.")
        elif drag_type == "by_offset":
            if x_offset == 0 and y_offset == 0:
                raise ValueError("At least one of x_offset or y_offset must be non-zero when drag_type='by_offset'.")

        resp = init_tool_response()
        try:
            if control_framework == "pywinauto":
                dlg = await app_manager.get_main_window()
                
                # Determine start point based on from_type
                if from_type == "element":
                    source = dlg.child_window(title_re=f".*{source_title}.*", control_type=source_control_type, found_index=0) 
                    start_point = source.rectangle().mid_point()
                else:  # from_type == "pixel"
                    start_point = Point(from_x, from_y)

                if drag_type == "by_offset":
                    # Simple offset-based movement from source location
                    end_point = (start_point.x + x_offset, start_point.y + y_offset)
                else:  # drag_type == "to_element"
                    target = dlg.child_window(title_re=f".*{target_title}.*", control_type=target_control_type, found_index=0)
                    target_center = target.rectangle().mid_point()
                    end_point = (target_center.x + x_offset, target_center.y + y_offset)

                mouse.press(coords=start_point, button=mouse_button)
                await asyncio.sleep(0.5)
                x1, y1 = start_point
                x2, y2 = end_point
                total_distance = hypot(x2 - x1, y2 - y1)
                step_size = 15
                steps = max(1, int(total_distance // step_size))
                for i in range(1, steps + 1):
                    xi = x1 + (x2 - x1) * i // steps
                    yi = y1 + (y2 - y1) * i // steps
                    mouse.move(coords=(xi, yi))
                    await asyncio.sleep(0.5)
                mouse.release(coords=end_point, button=mouse_button)
                await asyncio.sleep(2)
            else:
                raise NotImplementedError(f"mouse_drag_drop is not implemented for '{control_framework}' control_framework yet.")

            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            if drag_type == "to_element":
                if from_type == "element":
                    logging.error(f"Error dragging from '{source_title}' to '{target_title}': {repr(e)}")
                else:
                    logging.error(f"Error dragging from pixel ({from_x}, {from_y}) to '{target_title}': {repr(e)}")
            else:
                if from_type == "element":
                    logging.error(f"Error dragging from '{source_title}' by offset ({x_offset}, {y_offset}): {repr(e)}")
                else:
                    logging.error(f"Error dragging from pixel ({from_x}, {from_y}) by offset ({x_offset}, {y_offset}): {repr(e)}")
            
        return format_tool_response(resp)

    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def mouse_hover(
        caller: str, 
        control_framework: str, 
        name: str, 
        control_type: str,
        automation_id: str = '',
        control_idx: int = 1,
        class_name: str = '',
        parent_name: str = '',
        parent_control_type: str = '',
        parent_automation_id: str = '',
        scenario: str = '', 
        step_raw: str = '',
        step: str = '', 
        need_snapshot: int = 1, 
        timeout: int = 5) -> str:
        """
        Moves the mouse to hover over a specified UI element
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: The name/title of the element to hover over
            control_type: The type of control to hover over (Button, TreeItem, Text, etc.)
            automation_id: Optional automation ID of the element
            control_idx: Element index to select when multiple elements match (1-based).
                Default value 1.
            class_name: Optional class name of the element
            parent_name: The name/title of the parent element
            parent_control_type: The type of the parent control
            parent_automation_id: Optional automation ID of the parent element
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
                    name,
                    control_type,
                    automation_id=automation_id,
                    class_name=class_name,
                    control_idx=control_idx,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )
                if exists:
                    target_point = element.rectangle().mid_point()
                    mouse.move(coords=target_point)
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    logger.error(f"{resp['error']}: {search_kwargs}")
            else:
                raise NotImplementedError(f"mouse_hover is not implemented for '{control_framework}' control_framework yet.")
            
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)   
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logging.error(f"Error hovering over element '{name}': {repr(e)}")
            
        return format_tool_response(resp)


    @mcp.tool()
    @log_tool_call
    @record_calls(app_manager)
    async def mouse_scroll(
        caller: str, 
        control_framework: str, 
        name: str, 
        control_type: str,
        automation_id: str = '',
        control_idx: int = 1,
        class_name: str = '',
        wheel_dist: int = -5,
        parent_name: str = '',
        parent_control_type: str = '',
        parent_automation_id: str = '',
        scenario: str = '', 
        step_raw: str = '',
        step: str = '', 
        need_snapshot: int = 1, 
        timeout: int = 5) -> str:
        """
        Performs mouse scroll operation on a specified UI element
        
        Args:
            caller: Identifier of the calling module/function
            control_framework: str
                Specifies which automation framework to use for locating and interacting with elements.
                Available options:
                - 'pywinauto': Use the pywinauto framework to locate and control native desktop UI elements.
                This parameter determines which part of the snapshot will be used for element interaction.
            name: The name/title of the element
            control_type: The type of control (Button, TreeItem, Text, etc.)
            automation_id: Optional automation ID of the element
            control_idx: Element index to select when multiple elements match (1-based).    
                Default value 1.
            class_name: Optional class name of the element
            wheel_dist: Distance to scroll. Positive values scroll up, negative values scroll down.
                Default value 1.
            parent_name: The name/title of the parent element
            parent_control_type: The type of control of the parent element
            parent_automation_id: The exact automation_id of the parent control
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
                    name,
                    control_type,
                    automation_id=automation_id,
                    class_name=class_name,
                    control_idx=control_idx,
                    parent_name=parent_name,
                    parent_control_type=parent_control_type,
                    parent_automation_id=parent_automation_id,
                    timeout=timeout,
                )

                if exists:
                    target_point = element.rectangle().mid_point()
                    mouse.scroll(coords=target_point, wheel_dist=wheel_dist)
                    await asyncio.sleep(2)
                    resp["status"] = "success"
                else:
                    resp["status"] = "failed"
                    resp["error"] = f"[{search_kwargs}] of [{parent_search_kwargs}] not found within {timeout} seconds."
                    logger.error(f"{resp['error']}: {search_kwargs}")
            else:
                raise NotImplementedError(f"mouse_scroll is not implemented for '{control_framework}' control_framework yet.")
            
            await fill_snapshot(resp, app_manager, need_snapshot=need_snapshot)   
            resp["status"] = "success"
        except Exception as e:
            resp["status"] = "error"
            resp["error"] = repr(e)
            logging.error(f"Error scrolling element '{name}': {repr(e)}")
        return format_tool_response(resp)

