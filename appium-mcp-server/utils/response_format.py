# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

import json
from datetime import datetime
from typing import Any, Dict, Optional, Union, Literal


def init_tool_response() -> Dict[str, Any]:
    return {
        "status": "error",
        "data": {},
        "error": None,
        "timestamp": datetime.now().isoformat()
    }

def format_tool_response(
    response_dict: Dict[str, Any]
) -> str:
    if 'status' not in response_dict:
        raise ValueError("Response dictionary must contain 'status' key")
    
    response = {
        "status": response_dict["status"],
        "data": response_dict.get("data", {})
    }
    
    if "error" in response_dict and response_dict["error"]:
        response["error"] = response_dict["error"]
    
    return json.dumps(response, ensure_ascii=False)

def parse_tool_response(response_json: str) -> Dict[str, Any]:
    try:
        return json.loads(response_json)
    except json.JSONDecodeError:
        # 如果不是有效的JSON，返回一个错误状态的响应
        return {
            "status": "error",
            "data": {
            },
            "error": "Failed to parse response as JSON"
        }

def is_successful(response_json: str) -> bool:
    try:
        response = parse_tool_response(response_json)
        return (response["status"] == "success")
    except Exception:
        return False


def handle_page_source(resp, page_source, page_source_file="", summary_only=False):
    """Handle page source output with flexible control.

    Args:
        resp: The tool response dict to populate.
        page_source: The raw page source string (before simplification).
        page_source_file: If non-empty, save simplified page source to this file path.
        summary_only: If True, return agent-friendly summary instead of full page source.

    Behavior matrix:
        file=""  summary=False → resp["page_source"] = simplified
        file=""  summary=True  → resp["page_source_summary"] = summary
        file=X   summary=False → save simplified to file + resp["page_source"] = simplified
        file=X   summary=True  → save simplified to file + resp["page_source_summary"] = summary
    """
    from utils.element_util import simplify_page_source

    if "data" not in resp:
        resp["data"] = {}

    simplified = simplify_page_source(page_source)

    if page_source_file:
        with open(page_source_file, "w", encoding="utf-8") as f:
            f.write(simplified)
        resp["data"]["page_source_file"] = page_source_file

    if summary_only:
        from utils.element_util import summarize_page_source
        # Use raw page_source for summary to avoid parsing truncated XML
        resp["data"]["page_source_summary"] = summarize_page_source(page_source)
    else:
        resp["data"]["page_source"] = simplified

