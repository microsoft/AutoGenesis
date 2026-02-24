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
from tools.config_tool import register_config_tools
from utils.logger import log_tool_call, get_mcp_logger
from utils.config_manager import ConfigManager

logger = get_mcp_logger()

settings = {
    "log_level": "DEBUG"
}

# 创建 MCP server
mcp = FastMCP("appium-mcp-server", log_level="INFO")

# 配置MCP底层服务器日志过滤
def filter_mcp_lowlevel_logs():
    """过滤掉MCP底层服务器的INFO级别日志"""
    mcp_lowlevel_logger = logging.getLogger('mcp.server.lowlevel.server')
    mcp_lowlevel_logger.setLevel(logging.WARNING)

filter_mcp_lowlevel_logs()
driver_manager = None  # 全局可访问
config_manager = None  # 全局配置管理器


def on_config_change(new_config):
    """Callback when configuration changes"""
    global driver_manager
    if driver_manager:
        logger.info("Configuration changed, updating driver manager")
        driver_manager.update_config(new_config)


def main():
    global driver_manager, config_manager
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=["ios", "android", "mac"], default="ios")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="sse")
    parser.add_argument("--config", type=str, help="Path to config file")
    args = parser.parse_args()

    # Initialize config manager with file watching
    config_manager = ConfigManager(args.config, on_config_change=on_config_change)
    DRIVER_CONFIGS = config_manager.get_config()

    if not DRIVER_CONFIGS:
        print("No driver configurations found. Please check your config file.")
        sys.exit(1)

    driver_manager = DriverSessionManager(args.platform, driver_configs=DRIVER_CONFIGS)

    # Start watching for config file changes
    config_manager.start_watching()
    logger.info("Config file hot-reload enabled")

    # register tools
    register_appium_driver_tools(mcp, driver_manager)
    register_gen_code_tools(mcp, driver_manager)
    register_verify_tools(mcp, driver_manager)
    register_config_tools(mcp, config_manager)  # Register config management tools

    if args.platform == "ios":
        register_ios_driver_tools(mcp, driver_manager)
    elif args.platform == "android":
        register_android_driver_tools(mcp, driver_manager)
    elif args.platform == "mac":
        register_mac_driver_tools(mcp, driver_manager)
    else:
        pass

    # start MCP server
    try:
        mcp.run(transport=args.transport)
    finally:
        # Cleanup on shutdown
        if config_manager:
            config_manager.stop_watching()


if __name__ == "__main__":
    main()
