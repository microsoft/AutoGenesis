"""
Desktop Mac Skill for AutoGenesis.
Provides macOS desktop testing capabilities using Appium Mac2 driver.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from skills.base_skill import (
    BaseSkill,
    ExecutionContext,
    SkillManifest,
    SkillPlatform,
    ToolResponse,
)
from skills.desktop_mac_skill.session_manager import MacSessionManager


logger = logging.getLogger(__name__)


class DesktopMacSkill(BaseSkill):
    """
    Desktop Mac testing skill using Appium Mac2 driver.

    Uses the Mac2 driver for native macOS automation and supports:
    - Native Mac app automation
    - Element interactions with smart menu filtering
    - Keyboard shortcuts and key combinations
    - Mouse operations (click, right-click, hover, drag)
    - Visual verification with AI
    - BDD code generation
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Desktop Mac Skill.

        Args:
            config: Configuration including driver settings
        """
        super().__init__(config)
        self._session_manager: Optional[MacSessionManager] = None

    def _load_manifest(self) -> SkillManifest:
        """Load the skill manifest from JSON file."""
        manifest_path = Path(__file__).parent / "skill_manifest.json"
        return SkillManifest.from_json(manifest_path)

    async def initialize(self) -> bool:
        """
        Initialize the skill with Appium Mac2 driver.

        Returns:
            True if initialization successful
        """
        try:
            driver_configs = self.config.get("driver_configs", {})

            if not driver_configs:
                logger.warning("No driver_configs provided, skill will be in limited mode")
                self._initialized = True
                return True

            self._session_manager = MacSessionManager(driver_configs)

            self._initialized = True
            logger.info("Desktop Mac skill initialized")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Desktop Mac skill: {e}")
            return False

    async def execute(self, task: str, context: ExecutionContext) -> ToolResponse:
        """
        Execute a Mac desktop testing task.

        Args:
            task: Natural language task description
            context: Execution context

        Returns:
            ToolResponse with execution results
        """
        if not self._initialized:
            return ToolResponse(
                status="error",
                error="Desktop Mac skill not initialized"
            )

        task_lower = task.lower()

        try:
            if "launch" in task_lower or "start" in task_lower or "open" in task_lower:
                return await self._execute_app_launch(context)
            elif "close" in task_lower or "quit" in task_lower:
                return await self._execute_app_close(context)
            elif "click" in task_lower or "tap" in task_lower:
                return await self._execute_click(task, context)
            elif "type" in task_lower or "enter" in task_lower or "input" in task_lower:
                return await self._execute_send_keys(task, context)
            else:
                return ToolResponse(
                    status="error",
                    error=f"Could not interpret task: {task}",
                    data={"hint": "Try using specific tool names like click_element, send_keys_on_macos, etc."}
                )

        except Exception as e:
            logger.error(f"Error executing task: {e}")
            return ToolResponse(
                status="error",
                error=str(e)
            )

    async def _execute_app_launch(self, context: ExecutionContext) -> ToolResponse:
        """Execute app launch."""
        if not self._session_manager:
            return ToolResponse(status="error", error="Session manager not initialized")

        try:
            from skills.mobile_skill.element_utils import simplify_page_source

            self._session_manager.app_launch(kill_existing=1)
            page_source = self._session_manager.driver.page_source
            return ToolResponse(
                status="success",
                data={"page_source": simplify_page_source(page_source)}
            )
        except Exception as e:
            return ToolResponse(status="error", error=str(e))

    async def _execute_app_close(self, context: ExecutionContext) -> ToolResponse:
        """Execute app close."""
        if not self._session_manager:
            return ToolResponse(status="error", error="Session manager not initialized")

        try:
            self._session_manager.app_close()
            return ToolResponse(status="success")
        except Exception as e:
            return ToolResponse(status="error", error=str(e))

    async def _execute_click(self, task: str, context: ExecutionContext) -> ToolResponse:
        """Execute click operation."""
        return ToolResponse(
            status="error",
            error="Click requires element locator. Use click_element tool directly.",
            data={"task": task}
        )

    async def _execute_send_keys(self, task: str, context: ExecutionContext) -> ToolResponse:
        """Execute send_keys operation."""
        return ToolResponse(
            status="error",
            error="Send keys requires element and text. Use send_keys_on_macos tool directly.",
            data={"task": task}
        )

    def get_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        return [tool["name"] for tool in self.manifest.tools]

    def register_tools(self, mcp_server: Any, session_manager: Any = None) -> None:
        """
        Register all Mac skill tools with the MCP server.

        Args:
            mcp_server: FastMCP server instance
            session_manager: Optional session manager override
        """
        from skills.desktop_mac_skill.tools.mac_tools import register_mac_tools

        manager = session_manager or self._session_manager

        if manager is None:
            logger.warning("No session manager available, tools may not function properly")
            return

        register_mac_tools(mcp_server, manager)
        logger.info("Registered Desktop Mac tools")

    async def cleanup(self) -> None:
        """Clean up resources."""
        if self._session_manager:
            try:
                self._session_manager.session_close()
                logger.info("Desktop Mac skill session closed")
            except Exception as e:
                logger.error(f"Error closing Mac session: {e}")

        self._session_manager = None
        self._initialized = False

    @property
    def session_manager(self) -> Optional[MacSessionManager]:
        """Get the session manager."""
        return self._session_manager
