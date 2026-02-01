"""
Mobile Skill for AutoGenesis.
Provides mobile testing capabilities for iOS and Android platforms using Appium.
"""

import json
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
from skills.mobile_skill.session_manager import MobileSessionManager


logger = logging.getLogger(__name__)


class MobileSkill(BaseSkill):
    """
    Mobile testing skill for iOS and Android platforms.

    Uses Appium for automation and supports:
    - App lifecycle management (launch, close)
    - Element interactions (click, send_keys, swipe)
    - Visual verification with AI
    - BDD code generation
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Mobile Skill.

        Args:
            config: Configuration including platform and driver settings
        """
        super().__init__(config)
        self._session_manager: Optional[MobileSessionManager] = None
        self._platform: str = config.get("platform", "ios") if config else "ios"

    def _load_manifest(self) -> SkillManifest:
        """Load the skill manifest from JSON file."""
        manifest_path = Path(__file__).parent / "skill_manifest.json"
        return SkillManifest.from_json(manifest_path)

    async def initialize(self) -> bool:
        """
        Initialize the skill with Appium driver.

        Returns:
            True if initialization successful
        """
        try:
            driver_configs = self.config.get("driver_configs", {})

            if not driver_configs:
                logger.warning("No driver_configs provided, skill will be in limited mode")
                self._initialized = True
                return True

            self._session_manager = MobileSessionManager(
                platform=self._platform,
                driver_configs=driver_configs
            )

            self._initialized = True
            logger.info(f"Mobile skill initialized for platform: {self._platform}")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize mobile skill: {e}")
            return False

    async def execute(self, task: str, context: ExecutionContext) -> ToolResponse:
        """
        Execute a mobile testing task.

        This method interprets the task and delegates to appropriate tools.
        For direct tool execution, use the registered MCP tools.

        Args:
            task: Natural language task description
            context: Execution context

        Returns:
            ToolResponse with execution results
        """
        if not self._initialized:
            return ToolResponse(
                status="error",
                error="Mobile skill not initialized"
            )

        # This is a simplified implementation
        # In production, this would use LLM to interpret the task
        # and call appropriate tools

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
            elif "swipe" in task_lower or "scroll" in task_lower:
                return await self._execute_swipe(task, context)
            else:
                return ToolResponse(
                    status="error",
                    error=f"Could not interpret task: {task}",
                    data={"hint": "Try using specific tool names like click_element, send_keys, etc."}
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
        """Execute click operation - requires element info from task."""
        return ToolResponse(
            status="error",
            error="Click requires element locator. Use click_element tool directly.",
            data={"task": task}
        )

    async def _execute_send_keys(self, task: str, context: ExecutionContext) -> ToolResponse:
        """Execute send_keys operation - requires element and text from task."""
        return ToolResponse(
            status="error",
            error="Send keys requires element locator and text. Use send_keys tool directly.",
            data={"task": task}
        )

    async def _execute_swipe(self, task: str, context: ExecutionContext) -> ToolResponse:
        """Execute swipe operation - requires coordinates from task."""
        return ToolResponse(
            status="error",
            error="Swipe requires coordinates. Use swipe tool directly.",
            data={"task": task}
        )

    def get_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        return [tool["name"] for tool in self.manifest.tools]

    def register_tools(self, mcp_server: Any, session_manager: Any = None) -> None:
        """
        Register all mobile skill tools with the MCP server.

        Args:
            mcp_server: FastMCP server instance
            session_manager: Optional session manager override
        """
        from skills.mobile_skill.tools.appium_tools import register_appium_tools
        from skills.mobile_skill.tools.ios_tools import register_ios_tools
        from skills.mobile_skill.tools.android_tools import register_android_tools

        manager = session_manager or self._session_manager

        if manager is None:
            logger.warning("No session manager available, tools may not function properly")
            return

        # Register common Appium tools
        register_appium_tools(mcp_server, manager)

        # Register platform-specific tools
        if self._platform == "ios":
            register_ios_tools(mcp_server, manager)
        elif self._platform == "android":
            register_android_tools(mcp_server, manager)

        logger.info(f"Registered mobile tools for platform: {self._platform}")

    async def cleanup(self) -> None:
        """Clean up resources."""
        if self._session_manager:
            try:
                self._session_manager.session_close()
                logger.info("Mobile skill session closed")
            except Exception as e:
                logger.error(f"Error closing mobile session: {e}")

        self._session_manager = None
        self._initialized = False

    @property
    def session_manager(self) -> Optional[MobileSessionManager]:
        """Get the session manager."""
        return self._session_manager

    @property
    def platform(self) -> str:
        """Get the current platform."""
        return self._platform
