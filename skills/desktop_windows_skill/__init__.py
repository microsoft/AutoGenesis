"""
Desktop Windows Skill for AutoGenesis.
Provides Windows desktop testing capabilities using pywinauto.
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
from skills.desktop_windows_skill.session_manager import WindowsSessionManager


logger = logging.getLogger(__name__)


class DesktopWindowsSkill(BaseSkill):
    """
    Desktop Windows testing skill using pywinauto.

    Supports:
    - Native Windows application automation
    - Element interactions (click, type, select)
    - Keyboard shortcuts
    - Visual verification with AI
    - BDD code generation
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Desktop Windows Skill.

        Args:
            config: Configuration including application settings
        """
        super().__init__(config)
        self._session_manager: Optional[WindowsSessionManager] = None

    def _load_manifest(self) -> SkillManifest:
        """Load the skill manifest from JSON file."""
        manifest_path = Path(__file__).parent / "skill_manifest.json"
        return SkillManifest.from_json(manifest_path)

    async def initialize(self) -> bool:
        """
        Initialize the skill with pywinauto session.

        Returns:
            True if initialization successful
        """
        try:
            app_config = self.config.get("app_config", {})

            if not app_config:
                logger.warning("No app_config provided, skill will be in limited mode")
                self._initialized = True
                return True

            self._session_manager = WindowsSessionManager(app_config)

            self._initialized = True
            logger.info(f"Desktop Windows skill initialized for: {app_config.get('app_name', 'unknown')}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Desktop Windows skill: {e}")
            return False

    async def execute(self, task: str, context: ExecutionContext) -> ToolResponse:
        """
        Execute a Windows desktop testing task.

        Args:
            task: Natural language task description
            context: Execution context

        Returns:
            ToolResponse with execution results
        """
        if not self._initialized:
            return ToolResponse(
                status="error",
                error="Desktop Windows skill not initialized"
            )

        task_lower = task.lower()

        try:
            if "launch" in task_lower or "start" in task_lower or "open" in task_lower:
                return await self._execute_app_launch(context)
            elif "close" in task_lower or "quit" in task_lower:
                return await self._execute_app_close(context)
            elif "click" in task_lower:
                return await self._execute_click(task, context)
            elif "type" in task_lower or "enter" in task_lower or "input" in task_lower:
                return await self._execute_enter_text(task, context)
            else:
                return ToolResponse(
                    status="error",
                    error=f"Could not interpret task: {task}",
                    data={"hint": "Try using specific tool names like element_click, enter_text, etc."}
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
            await self._session_manager.app_launch(kill_existing=1)
            return ToolResponse(status="success")
        except Exception as e:
            return ToolResponse(status="error", error=str(e))

    async def _execute_app_close(self, context: ExecutionContext) -> ToolResponse:
        """Execute app close."""
        if not self._session_manager:
            return ToolResponse(status="error", error="Session manager not initialized")

        try:
            await self._session_manager.app_close()
            return ToolResponse(status="success")
        except Exception as e:
            return ToolResponse(status="error", error=str(e))

    async def _execute_click(self, task: str, context: ExecutionContext) -> ToolResponse:
        """Execute click operation - requires element info from task."""
        return ToolResponse(
            status="error",
            error="Click requires element info. Use element_click tool directly.",
            data={"task": task}
        )

    async def _execute_enter_text(self, task: str, context: ExecutionContext) -> ToolResponse:
        """Execute enter text operation - requires element and text from task."""
        return ToolResponse(
            status="error",
            error="Enter text requires element info and text. Use enter_text tool directly.",
            data={"task": task}
        )

    def get_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        return [tool["name"] for tool in self.manifest.tools]

    def register_tools(self, mcp_server: Any, session_manager: Any = None) -> None:
        """
        Register all desktop windows skill tools with the MCP server.

        Args:
            mcp_server: FastMCP server instance
            session_manager: Optional session manager override
        """
        from skills.desktop_windows_skill.tools.common_tools import register_common_tools
        from skills.desktop_windows_skill.tools.verify_tools import register_verify_tools

        manager = session_manager or self._session_manager

        if manager is None:
            logger.warning("No session manager available, tools may not function properly")
            return

        # Register tools
        register_common_tools(mcp_server, manager)
        register_verify_tools(mcp_server, manager)

        logger.info("Registered Desktop Windows tools")

    async def cleanup(self) -> None:
        """Clean up resources."""
        if self._session_manager:
            try:
                await self._session_manager.app_close()
                logger.info("Desktop Windows skill session closed")
            except Exception as e:
                logger.error(f"Error closing Windows session: {e}")

        self._session_manager = None
        self._initialized = False

    @property
    def session_manager(self) -> Optional[WindowsSessionManager]:
        """Get the session manager."""
        return self._session_manager
