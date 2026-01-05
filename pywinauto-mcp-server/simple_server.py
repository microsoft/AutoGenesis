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


logger = logging.getLogger(__name__)

# Create MCP server
mcp = FastMCP("pywinauto-mcp-server", log_level="INFO")
app_manager = None


def load_app_config(file_path=None):
    """Load app configuration from JSON file."""
    if file_path is not None:
        app_conf_path = Path(file_path)
    else:
        app_conf_path = Path(__file__).parent / "conf" / "pywinauto_conf.json"

    if not app_conf_path.exists():
        logger.error(f"App configuration file not found: {app_conf_path}")  
        raise FileNotFoundError(f"App configuration file not found: {app_conf_path}")
    
    with open(app_conf_path, 'r', encoding='utf-8') as f:
        app_conf = json.load(f)

    return app_conf.get("PYWINAUTO_CONFIG", {})

async def main():
    global app_manager
    parser = argparse.ArgumentParser()
    parser.add_argument("--transport", choices=["stdio", "sse"], default="sse")
    parser.add_argument("--config", type=str, help="Path to config file")
    args = parser.parse_args()

    app_conf = load_app_config(args.config)
    if not app_conf:
        logger.error("No app configurations found. Please check your config file.")
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
