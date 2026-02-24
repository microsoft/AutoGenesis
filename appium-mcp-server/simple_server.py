# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

# # -*- coding: utf-8 -*-
import json
import os
import logging
import sys
import argparse
from mcp.server.fastmcp import FastMCP
from driver_session import DriverSessionManager
from tools.appium_driver_tool import register_appium_driver_tools
from tools.ios_driver_tool import register_ios_driver_tools
from tools.android_driver_tool import register_android_driver_tools
from tools.mac_driver_tool import register_mac_driver_tools
from tools.gen_code_tool import register_gen_code_tools
from tools.verify_tools import register_verify_tools
from utils.logger import log_tool_call

settings = {
    "log_level": "DEBUG"
}

def load_driver_configs(file_path=None):
    """Load driver configurations from a JSON file."""
    if file_path is None:
       file_path = os.path.join(os.path.dirname(__file__), "conf/appium_conf.json")

    if not os.path.exists(file_path):
       raise FileNotFoundError(f"Driver configuration file not found: {file_path}")

    with open(file_path, 'r') as f:
        driver_configs = json.load(f)
        appium_driver_configs = driver_configs.get("APPIUM_DRIVER_CONFIGS", {})

    return appium_driver_configs

# 创建 MCP server
mcp = FastMCP("appium-mcp-server", log_level="INFO")

# 配置MCP底层服务器日志过滤
def filter_mcp_lowlevel_logs():
    """过滤掉MCP底层服务器的INFO级别日志"""
    mcp_lowlevel_logger = logging.getLogger('mcp.server.lowlevel.server')
    mcp_lowlevel_logger.setLevel(logging.WARNING)

filter_mcp_lowlevel_logs()
driver_manager = None  # 全局可访问


def main():
    global driver_manager
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=["ios", "android", "mac"], default="ios")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="sse")
    parser.add_argument("--config", type=str, help="Path to config file")
    args = parser.parse_args()

    DRIVER_CONFIGS = load_driver_configs(args.config)
    if not DRIVER_CONFIGS:
        print("No driver configurations found. Please check your config file.")
        sys.exit(1)
    
    driver_manager = DriverSessionManager(args.platform, driver_configs=DRIVER_CONFIGS)

    # register tools
    register_appium_driver_tools(mcp, driver_manager)
    register_gen_code_tools(mcp, driver_manager)
    register_verify_tools(mcp, driver_manager)

    if args.platform == "ios":
        register_ios_driver_tools(mcp, driver_manager)
    elif args.platform == "android":
        register_android_driver_tools(mcp, driver_manager)
    elif args.platform == "mac":
        register_mac_driver_tools(mcp, driver_manager)
    else:
        pass

    # start MCP server
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
