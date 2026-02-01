# -*- coding: utf-8 -*-
"""
Unified MCP Server for AutoGenesis.

This server provides a single entry point for all AutoGenesis skills:
- Mobile (iOS/Android)
- Desktop Windows
- Desktop Mac

Supports both stdio and SSE transports for Claude Code and VS Code integration.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from anyio import BrokenResourceError
from mcp.server.fastmcp import FastMCP

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.utils.logger import get_mcp_logger
from core.utils.response_format import format_tool_response, init_tool_response
from core.bdd.gen_code import (
    HEADER_AUTO_GEN,
    STEPS_DIR_DEFAULT,
    TARGET_STEP_FILE_DEFAULT,
    gen_code_preview,
    ensure_step_path_exists,
    gen_step_file_from_feature_path,
    parse_steps_dir_from_step_path,
)


logger = get_mcp_logger()

# Create unified MCP server
mcp = FastMCP("autogenesis-mcp-server", log_level="INFO")


def filter_mcp_lowlevel_logs():
    """Filter out MCP low-level INFO logs."""
    mcp_lowlevel_logger = logging.getLogger('mcp.server.lowlevel.server')
    mcp_lowlevel_logger.setLevel(logging.WARNING)


filter_mcp_lowlevel_logs()


def load_config(file_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load unified configuration from JSON file.

    Args:
        file_path: Path to config file. If None, uses default location.

    Returns:
        Configuration dictionary with driver configs for each platform.
    """
    if file_path is not None:
        config_path = Path(file_path)
    else:
        config_path = project_root / "conf" / "autogenesis_conf.json"

    if not config_path.exists():
        logger.warning(f"Config file not found: {config_path}")
        return {}

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    return config


class UnifiedSessionManager:
    """
    Unified session manager that coordinates all platform-specific session managers.

    This manager handles:
    - Loading platform-specific session managers on demand
    - BDD code generation cache (shared across platforms)
    - Session lifecycle management
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the unified session manager.

        Args:
            config: Unified configuration containing platform-specific settings.
        """
        self.config = config
        self._mobile_manager = None
        self._windows_manager = None
        self._mac_manager = None

        # BDD code generation state (shared across platforms)
        self.gen_code_id: Optional[str] = None
        self.gen_code_cache = []
        self.proposed_changes: Optional[str] = None
        self.header_code: str = ""
        self.steps_dir: str = STEPS_DIR_DEFAULT
        self.step_file_target: str = TARGET_STEP_FILE_DEFAULT
        self.new_steps_count: int = 0

    @property
    def mobile_manager(self):
        """Lazy-load mobile session manager."""
        if self._mobile_manager is None:
            mobile_config = self.config.get("mobile", {})
            if mobile_config:
                from skills.mobile_skill.session_manager import MobileSessionManager
                self._mobile_manager = MobileSessionManager(mobile_config)
                # Share code generation state
                self._share_gen_code_state(self._mobile_manager)
        return self._mobile_manager

    @property
    def windows_manager(self):
        """Lazy-load Windows session manager."""
        if self._windows_manager is None:
            windows_config = self.config.get("windows", {})
            if windows_config:
                from skills.desktop_windows_skill.session_manager import WindowsSessionManager
                self._windows_manager = WindowsSessionManager(windows_config)
                self._share_gen_code_state(self._windows_manager)
        return self._windows_manager

    @property
    def mac_manager(self):
        """Lazy-load Mac session manager."""
        if self._mac_manager is None:
            mac_config = self.config.get("mac", {})
            if mac_config:
                from skills.desktop_mac_skill.session_manager import MacSessionManager
                driver_configs = {"mac": mac_config}
                self._mac_manager = MacSessionManager(driver_configs)
                self._share_gen_code_state(self._mac_manager)
        return self._mac_manager

    def _share_gen_code_state(self, manager):
        """Share code generation state with a platform manager."""
        # The platform managers will access these via the unified manager
        pass

    def get_active_manager(self, platform: str):
        """
        Get the session manager for a specific platform.

        Args:
            platform: Platform name (mobile, ios, android, windows, mac)

        Returns:
            The appropriate session manager.
        """
        platform_lower = platform.lower()
        if platform_lower in ("mobile", "ios", "android"):
            return self.mobile_manager
        elif platform_lower == "windows":
            return self.windows_manager
        elif platform_lower == "mac":
            return self.mac_manager
        else:
            raise ValueError(f"Unknown platform: {platform}")

    def push_data_to_gen_code(
        self,
        caller: str,
        tool_name: str,
        step: str,
        scenario: str,
        param: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Push data to the code generation cache.

        Args:
            caller: Caller identifier
            tool_name: Name of the tool called
            step: BDD step text
            scenario: Scenario name
            param: Tool parameters
        """
        if self.gen_code_id:
            data = {
                "gen_code_id": self.gen_code_id,
                "tool_name": tool_name,
                "step": step,
                "scenario": scenario,
                "param": param,
                "caller": caller,
            }
            self.gen_code_cache.append(data)
        else:
            logger.warning("No gen_code_id found. Cannot push data.")

    def clear_gen_code_cache(self) -> None:
        """Clear the code generation cache."""
        self.gen_code_cache.clear()
        self.gen_code_id = None
        self.proposed_changes = None
        self.header_code = ""

    def cleanup_all(self) -> None:
        """Clean up all session managers."""
        if self._mobile_manager:
            try:
                self._mobile_manager.session_close()
            except Exception as e:
                logger.warning(f"Error closing mobile session: {e}")
            self._mobile_manager = None

        if self._windows_manager:
            try:
                self._windows_manager.app_close()
            except Exception as e:
                logger.warning(f"Error closing Windows session: {e}")
            self._windows_manager = None

        if self._mac_manager:
            try:
                self._mac_manager.session_close()
            except Exception as e:
                logger.warning(f"Error closing Mac session: {e}")
            self._mac_manager = None


# Global session manager
session_manager: Optional[UnifiedSessionManager] = None


def register_gen_code_tools(mcp_server: FastMCP, manager: UnifiedSessionManager):
    """
    Register BDD code generation tools with the MCP server.

    These tools are platform-agnostic and work with any skill.

    Args:
        mcp_server: FastMCP server instance
        manager: Unified session manager
    """

    @mcp_server.tool()
    async def before_gen_code(feature_file: str = '', step_file: str = '') -> str:
        """
        Initialize BDD code generation session before executing test steps.

        Call this ONCE before starting to execute test case steps.
        It clears any existing code generation cache and sets up a new session.

        Args:
            feature_file: Full absolute path to the .feature file containing BDD scenarios.
            step_file: Full absolute path to the Python step definition file (.py).

        Returns:
            JSON response with gen_code_id, steps_dir, and step_file_target.
        """
        try:
            resp = init_tool_response()
            manager.clear_gen_code_cache()
            manager.gen_code_id = str(uuid.uuid4())
            logger.info(f"[GEN CODE START]: {manager.gen_code_id}")

            if step_file and step_file.endswith('.py'):
                manager.steps_dir = parse_steps_dir_from_step_path(step_file)
                manager.step_file_target = step_file
            elif feature_file:
                manager.steps_dir, manager.step_file_target = gen_step_file_from_feature_path(feature_file)
            else:
                manager.steps_dir = STEPS_DIR_DEFAULT
                manager.step_file_target = TARGET_STEP_FILE_DEFAULT

            resp["status"] = "success"
            resp["data"] = {
                "gen_code_id": manager.gen_code_id,
                "steps_dir": manager.steps_dir,
                "step_file_target": manager.step_file_target,
            }
        except Exception as e:
            resp["error"] = f"Error during code generation initialization: {repr(e)}"
            logger.error(resp["error"])
            raise

        return json.dumps(format_tool_response(resp))

    @mcp_server.tool()
    async def preview_code_changes() -> str:
        """
        Preview generated BDD step definition code changes.

        Shows a diff of the code that will be added to the step file.
        Call this after executing test steps to review before applying.

        Returns:
            JSON response with diff_preview showing proposed changes.
        """
        resp = init_tool_response()

        if not manager.gen_code_id or not manager.gen_code_cache:
            resp["status"] = "success"
            resp["data"] = {"message": "No pending code changes to preview"}
            return json.dumps(format_tool_response(resp))

        result = gen_code_preview(manager)
        resp["status"] = "success"
        resp["data"] = {"diff_preview": result.get('diff_preview')}

        return json.dumps(format_tool_response(resp))

    @mcp_server.tool()
    async def confirm_code_changes() -> str:
        """
        Confirm and apply the previewed BDD code changes.

        Writes the generated step definitions to the target file.
        Call preview_code_changes() first to review the changes.

        Returns:
            JSON response with message about applied changes.
        """
        resp = init_tool_response()

        if not hasattr(manager, 'proposed_changes') or not manager.proposed_changes:
            resp["status"] = "success"
            resp["data"] = {"message": "No pending code changes to confirm"}
            return json.dumps(format_tool_response(resp))

        if not ensure_step_path_exists(manager.step_file_target):
            resp["status"] = "error"
            resp["error"] = f"Failed to create directory structure for {manager.step_file_target}"
            return json.dumps(format_tool_response(resp))

        try:
            with open(manager.step_file_target, 'a', encoding='utf-8') as f:
                if hasattr(manager, 'header_code') and manager.header_code:
                    f.write(manager.header_code + "\n")
                for item in manager.proposed_changes:
                    f.write(item + "\n")

            result = f"Applied {len(manager.proposed_changes)} new steps to {manager.step_file_target}"
            manager.new_steps_count = len(manager.proposed_changes)
            resp["status"] = "success"
            resp["data"] = {"message": result, "new_steps_count": manager.new_steps_count}
        except Exception as e:
            result = f"Error applying changes to {manager.step_file_target}: {str(e)}"
            logger.error(result)
            resp["status"] = "error"
            resp["error"] = result

        # Clear the proposed changes
        manager.clear_gen_code_cache()
        return json.dumps(format_tool_response(resp))


def register_all_tools(
    mcp_server: FastMCP,
    manager: UnifiedSessionManager,
    platforms: list
):
    """
    Register all tools for the specified platforms.

    Args:
        mcp_server: FastMCP server instance
        manager: Unified session manager
        platforms: List of platforms to enable ("mobile", "windows", "mac", or "all")
    """
    # Always register BDD code generation tools
    register_gen_code_tools(mcp_server, manager)

    enable_all = "all" in platforms

    # Register mobile tools
    if enable_all or "mobile" in platforms or "ios" in platforms or "android" in platforms:
        if manager.mobile_manager:
            from skills.mobile_skill.tools import (
                register_appium_tools,
                register_ios_tools,
                register_android_tools,
            )
            register_appium_tools(mcp_server, manager.mobile_manager)
            if enable_all or "ios" in platforms:
                register_ios_tools(mcp_server, manager.mobile_manager)
            if enable_all or "android" in platforms:
                register_android_tools(mcp_server, manager.mobile_manager)
            logger.info("Registered Mobile skill tools")
        else:
            logger.warning("Mobile config not found, skipping Mobile skill tools")

    # Register Windows tools
    if enable_all or "windows" in platforms:
        if manager.windows_manager:
            from skills.desktop_windows_skill.tools import (
                register_common_tools,
                register_verify_tools,
            )
            register_common_tools(mcp_server, manager.windows_manager)
            register_verify_tools(mcp_server, manager.windows_manager)
            logger.info("Registered Desktop Windows skill tools")
        else:
            logger.warning("Windows config not found, skipping Desktop Windows skill tools")

    # Register Mac tools
    if enable_all or "mac" in platforms:
        if manager.mac_manager:
            from skills.desktop_mac_skill.tools import register_mac_tools
            register_mac_tools(mcp_server, manager.mac_manager)
            logger.info("Registered Desktop Mac skill tools")
        else:
            logger.warning("Mac config not found, skipping Desktop Mac skill tools")


async def run_server(transport: str, config_path: Optional[str], platforms: list):
    """
    Run the unified MCP server.

    Args:
        transport: Transport type ("stdio" or "sse")
        config_path: Path to configuration file
        platforms: List of platforms to enable
    """
    global session_manager

    # Load configuration
    config = load_config(config_path)
    if not config:
        logger.warning("No configuration loaded, server will run with limited functionality")

    # Initialize unified session manager
    session_manager = UnifiedSessionManager(config)

    # Register tools
    register_all_tools(mcp, session_manager, platforms)

    logger.info(f"Starting AutoGenesis MCP server with transport={transport}, platforms={platforms}")

    try:
        if transport == "stdio":
            await mcp.run_stdio_async()
        else:  # transport == "sse"
            await mcp.run_sse_async()
    except (BrokenResourceError, EOFError, ValueError) as e:
        logger.warning(f"[MCP] Cancel detected, exiting: {repr(e)}")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"[MCP] Unexpected error: {repr(e)}")
        sys.exit(1)
    finally:
        if session_manager:
            session_manager.cleanup_all()


def main():
    """Main entry point for the unified MCP server."""
    parser = argparse.ArgumentParser(
        description="AutoGenesis Unified MCP Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with all platforms (default)
  python unified_mcp_server.py --transport stdio

  # Run with specific platforms
  python unified_mcp_server.py --platform mobile --platform mac

  # Run with custom config
  python unified_mcp_server.py --config /path/to/config.json
        """
    )
    parser.add_argument(
        "--platform",
        action="append",
        choices=["all", "mobile", "ios", "android", "windows", "mac"],
        default=None,
        help="Platform(s) to enable (can be specified multiple times). Default: all"
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport type (default: stdio)"
    )
    parser.add_argument(
        "--config",
        type=str,
        help="Path to configuration file"
    )

    args = parser.parse_args()

    # Default to all platforms if none specified
    platforms = args.platform if args.platform else ["all"]

    asyncio.run(run_server(args.transport, args.config, platforms))


if __name__ == "__main__":
    main()
