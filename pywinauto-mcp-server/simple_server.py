# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

# # -*- coding: utf-8 -*-
import os
import logging
import json
import sys
import argparse
import anyio
import asyncio
from anyio import BrokenResourceError
from mcp.server.fastmcp import FastMCP
from pathlib import Path
from app_session import AppSessionManager
from tools.common_tool import register_common_tools
from tools.gen_code_tool import register_gen_code_tools
from tools.mouse_tool import register_mouse_tools
from tools.verify_tool import register_verify_tools
from typing import Any


logger = logging.getLogger(__name__)

# Create MCP server
mcp = FastMCP("pywinauto-mcp-server", log_level="INFO")
app_manager = None


def expand_env_vars(obj: Any) -> Any:
    """
    Recursively expand environment variables in a JSON-like structure.
    Supports dict / list / str.
    """
    if isinstance(obj, dict):
        return {k: expand_env_vars(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [expand_env_vars(i) for i in obj]
    elif isinstance(obj, str):
        return os.path.expandvars(obj)
    else:
        return obj


def load_app_config(app_name, file_path=None):
    """Load app configuration from JSON file."""
    if file_path is not None:
        apps_conf_path = Path(file_path)
    else:
        apps_conf_path = Path(__file__).parent / "conf" / "pywinauto_conf.json"

    if not apps_conf_path.exists():
        logger.error(f"Apps configuration file not found: {apps_conf_path}")
        raise FileNotFoundError(f"Apps configuration file not found: {apps_conf_path}")

    with open(apps_conf_path, 'r', encoding='utf-8') as f:
        apps_conf = json.load(f)

    apps_config = apps_conf.get("PYWINAUTO_CONFIG", {}).get("apps_config", {})
    if not apps_config:
        raise ValueError("No app configurations found in config file.")
    
    if not app_name:
        app_name = next(iter(apps_config))
        logger.info(f"No app name provided, using first config: '{app_name}'")

    app_conf = expand_env_vars(apps_config.get(app_name, {}))
    return app_conf


async def main():
    global app_manager
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=str, required=False, help="app to automate, e.g. 'edge', if not set, will use the first app in the config file")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="sse")
    parser.add_argument("--config", type=str, help="Path to config file")
    args = parser.parse_args()

    app_conf = load_app_config(args.app, args.config)
    logger.info(f"Loaded app configuration for {args.app}: {app_conf}")
    if not app_conf:
        logger.error(f"No app configurations found for {args.app}. Please check your config file.")
        sys.exit(1)
    
    logger.info(f"Loaded app configuration: {app_conf}")
    app_manager = AppSessionManager(app_conf)

    register_common_tools(mcp, app_manager)
    register_mouse_tools(mcp, app_manager)
    register_gen_code_tools(mcp, app_manager)
    register_verify_tools(mcp, app_manager)

    try:
        if args.transport == "stdio":
            await mcp.run_stdio_async()
        else:  # transport == "sse"
            await mcp.run_sse_async()
    except (BrokenResourceError, EOFError, ValueError) as e:
        logger.warning(f"[MCP] Cancel detected, exiting: {repr(e)}")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"[MCP] Unexpected error: {repr(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
