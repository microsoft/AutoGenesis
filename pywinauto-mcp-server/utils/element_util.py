# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import time
import logging
from pympler import asizeof


logger = logging.getLogger(__name__)


UIA_PAGE_ROOT_LIST = []
SNAPSHOT_MAX_SIZE = 800000

total_size = 0
total_size_break = False


async def extract_element_info_async(element, max_root_depth=10, web_depth=0, limited_page_length=15, in_limited_page=False):
    """
    Extracts information from a UI element and its children recursively.

    Args:
        element: The UI element to extract information from.
        max_root_depth: Maximum depth for root elements.
        web_depth: Current depth in the web hierarchy.
        limited_page_length: Maximum number of children to process in a limited page.
        in_limited_page: Boolean indicating if the current element is within a limited page.

    Returns:
        A dictionary containing the extracted information.
    """
    global total_size, total_size_break
    total_size = 0
    total_size_break = False
    snapshot = {
        "snapshot_pywinauto": extract_element_info_from_pwa(element, 
                                                            max_root_depth=max_root_depth, 
                                                            web_depth=web_depth, 
                                                            limited_page_length=limited_page_length, 
                                                            in_limited_page=in_limited_page,
                                                            runtime_ids=[]
                                                            ),
    }

    return snapshot


def extract_element_info_from_pwa(element, max_root_depth=10, web_depth=0, limited_page_length=15, in_limited_page=False, runtime_ids=[]):
    global total_size
    global total_size_break
    
    rect = element.rectangle()
    info = {
        "title": element.window_text(),
        "control_type": element.element_info.control_type,
        "automation_id": element.element_info.automation_id,
        "class_name": element.element_info.class_name,
        "rectangle": {
            "left": rect.left,
            "top": rect.top,
            "right": rect.right,
            "bottom": rect.bottom
        },
        "children": []
    }
    if total_size + asizeof.asizeof(info) > SNAPSHOT_MAX_SIZE:
        logger.warning(f"Snapshot size exceeded limit of {SNAPSHOT_MAX_SIZE} bytes, stopping further extraction.")
        logger.warning(f"Current element: {info}\n\n")
        total_size_break = True 
        return None
    
    total_size += asizeof.asizeof(info)
    runtime_ids.append(element.element_info.runtime_id)

    try:
        info["value"] = element.get_value(),
    except Exception as e:
        pass

    try:
        if element.element_info.control_type == "CheckBox":
            info["is_checked"] = element.get_toggle_state() == 1
    except Exception as e:
        pass
    
    is_web_page_root = False
    if element.element_info.automation_id == "RootWebArea" and element.element_info.control_type == "Document":
        if element.window_text() not in UIA_PAGE_ROOT_LIST:
            is_web_page_root = True
            in_limited_page = True

    if in_limited_page and web_depth >= max_root_depth:
        return info

    next_web_depth = web_depth + 1 if web_depth > 0 else 0
    if is_web_page_root and web_depth == 0: 
        next_web_depth = 1

    idx_web_length = 0
    for child in element.children():
        if child.element_info.runtime_id in runtime_ids:
            continue
        if in_limited_page and idx_web_length >= limited_page_length:
            break
        if total_size_break:
            break 

        idx_web_length += 1
        child_info = extract_element_info_from_pwa(child, max_root_depth=max_root_depth, 
                                                     web_depth=next_web_depth, 
                                                     limited_page_length=limited_page_length, 
                                                     in_limited_page=in_limited_page,
                                                     runtime_ids=runtime_ids
                                                     )
        if child_info is None:
            break

        info["children"].append(child_info)
    return info


async def fill_snapshot(resp, app_manager, need_snapshot: int):
    if need_snapshot == 1:
        main_window = await app_manager.get_main_window()
        snapshot = await extract_element_info_async(main_window)
        resp["data"] = {"snapshot": snapshot}


async def find_element_by_kwargs(
        app_manager,
        name: str,
        control_type: str,
        automation_id: str,
        control_idx: int = -1,
        class_name: str = "",
        parent_name: str = "",
        parent_control_type: str = "",
        parent_automation_id: str = "",
        parent_control_idx: int = 1,
        parent_class_name: str = "",
        timeout: int = 5,
        main_window_type: str = "",
        search_type: str = "normal",
    ):
    main_window = await app_manager.get_main_window(main_window_type=main_window_type)

    # Find parent element if specified
    search_parent = main_window
    parent_search_kwargs = {}
    if parent_name or parent_control_type or parent_class_name or parent_automation_id:
        parent_search_kwargs = {"title": parent_name}
        if parent_control_type:
            parent_search_kwargs["control_type"] = parent_control_type
        if parent_class_name:
            parent_search_kwargs["class_name"] = parent_class_name
        if parent_automation_id:
            parent_search_kwargs["auto_id"] = parent_automation_id
        if parent_control_idx > 0:
            parent_search_kwargs["found_index"] = parent_control_idx - 1
        search_parent = main_window.child_window(**parent_search_kwargs)

    search_kwargs = {}
    if control_type:
        search_kwargs["control_type"] = control_type
    if automation_id:
        search_kwargs["auto_id"] = automation_id
    if control_idx > 0:
        search_kwargs["found_index"] = control_idx - 1
    if class_name:
        search_kwargs["class_name"] = class_name

    if search_type == 'fuzzy':
        search_kwargs["title_re"] = f".*{name}.*"
    else:
        search_kwargs["title"] = name

    element = search_parent.child_window(**search_kwargs)
    exists = element.exists(timeout=timeout)
    if search_type == "normal" and not exists:
        search_kwargs.pop("title", None)
        search_kwargs["title_re"] = f".*{name}.*"
        element = search_parent.child_window(**search_kwargs)
        exists = element.exists(timeout=timeout)

    return element, exists, search_kwargs, parent_search_kwargs


def get_screenshot_main_window(app_manager):
    main_window = app_manager.get_main_window_sync()
    if not main_window:
        return None
    try:
        img = main_window.capture_as_image()
        return img
    except Exception as e:
        logger.error(f"Failed to capture screenshot of the main window: {e}")
        return None