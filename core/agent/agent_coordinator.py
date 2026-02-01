"""
Agent Coordinator for AutoGenesis.
Central orchestrator that coordinates testing operations across skills.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from core.agent.context_manager import ContextManager, SessionContext
from core.agent.skill_loader import SkillLoader
from core.llm.chat import LLMClient, is_ai_enabled
from skills.base_skill import BaseSkill, ExecutionContext, SkillPlatform, ToolResponse


logger = logging.getLogger(__name__)


class AgentCoordinator:
    """
    Central AI Agent that orchestrates testing operations.

    Responsibilities:
    - Route tasks to appropriate skills based on platform detection
    - Manage conversation context across tool calls
    - Coordinate BDD test recording workflow
    - Handle multi-turn interactions
    """

    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        llm_client: Optional[LLMClient] = None,
    ):
        """
        Initialize the Agent Coordinator.

        Args:
            config: Agent configuration
            llm_client: Optional pre-configured LLM client
        """
        self.config = config or {}
        self._skill_loader = SkillLoader()
        self._context_manager = ContextManager()
        self._llm_client = llm_client
        self._initialized = False
        self._skills: Dict[str, BaseSkill] = {}

    @property
    def skills(self) -> Dict[str, BaseSkill]:
        """Get loaded skills."""
        return self._skills

    @property
    def context_manager(self) -> ContextManager:
        """Get the context manager."""
        return self._context_manager

    @property
    def is_initialized(self) -> bool:
        """Check if agent has been initialized."""
        return self._initialized

    async def initialize(self) -> bool:
        """
        Initialize the agent and load all available skills.

        Returns:
            True if initialization successful
        """
        if self._initialized:
            logger.warning("Agent already initialized")
            return True

        try:
            # Initialize LLM client if AI is enabled and not provided
            if is_ai_enabled() and self._llm_client is None:
                self._llm_client = LLMClient()
                logger.info("LLM client initialized")

            # Load skill configurations from agent config
            skill_configs = self.config.get("skills", {})

            # Load all available skills
            self._skills = await self._skill_loader.load_all_skills(skill_configs)

            if not self._skills:
                logger.warning("No skills were loaded")
            else:
                logger.info(f"Loaded {len(self._skills)} skills: {list(self._skills.keys())}")

            self._initialized = True
            return True

        except Exception as e:
            logger.error(f"Failed to initialize agent: {e}")
            return False

    async def execute_task(
        self,
        task: str,
        session_id: Optional[str] = None,
        platform: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ToolResponse:
        """
        Execute a testing task using the appropriate skill.

        This is the main entry point for task execution. The agent will:
        1. Detect the target platform (if not specified)
        2. Select the appropriate skill
        3. Execute the task
        4. Record the action in context

        Args:
            task: Natural language task description
            session_id: Session ID for context tracking
            platform: Target platform (auto-detected if not specified)
            context: Additional execution context

        Returns:
            ToolResponse with execution results
        """
        if not self._initialized:
            return ToolResponse(
                status="error",
                error="Agent not initialized. Call initialize() first."
            )

        context = context or {}

        # Get or create session
        if session_id:
            session = self._context_manager.get_or_create_session(session_id)
        else:
            session = self._context_manager.create_session()
            session_id = session.session_id

        # Detect platform if not specified
        target_platform = self._resolve_platform(task, platform)

        if target_platform is None:
            return ToolResponse(
                status="error",
                error="Could not determine target platform. Please specify platform explicitly.",
                data={"available_platforms": [p.value for p in SkillPlatform]}
            )

        # Find skill for platform
        skill = self._skill_loader.get_skill_for_platform(target_platform)

        if skill is None:
            return ToolResponse(
                status="error",
                error=f"No skill available for platform: {target_platform.value}",
                data={"loaded_skills": list(self._skills.keys())}
            )

        # Build execution context
        exec_context = ExecutionContext(
            scenario=context.get("scenario", session.current_scenario or ""),
            feature_file=context.get("feature_file", session.feature_file or ""),
            step=context.get("step", ""),
            step_raw=context.get("step_raw", task),
            caller=context.get("caller", "agent"),
            gen_code_id=context.get("gen_code_id", session.gen_code_id),
        )

        # Execute task
        try:
            logger.info(f"Executing task with {skill.name}: {task[:100]}...")
            result = await skill.execute(task, exec_context)

            # Record action in context
            self._context_manager.add_to_context(
                session_id=session_id,
                tool_name=f"{skill.name}.execute",
                arguments={"task": task, "context": exec_context.to_dict()},
                result=result.to_dict(),
                step=exec_context.step,
                scenario=exec_context.scenario,
            )

            return result

        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            error_result = ToolResponse(
                status="error",
                error=str(e),
                data={"task": task, "platform": target_platform.value}
            )

            # Record failed action
            self._context_manager.add_to_context(
                session_id=session_id,
                tool_name=f"{skill.name}.execute",
                arguments={"task": task},
                result=error_result.to_dict(),
                step=exec_context.step,
                scenario=exec_context.scenario,
            )

            return error_result

    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        session_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ToolResponse:
        """
        Execute a specific tool directly.

        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments
            session_id: Session ID for context tracking
            context: Additional execution context

        Returns:
            ToolResponse with execution results
        """
        if not self._initialized:
            return ToolResponse(
                status="error",
                error="Agent not initialized. Call initialize() first."
            )

        context = context or {}

        # Get or create session
        if session_id:
            session = self._context_manager.get_or_create_session(session_id)
        else:
            session = self._context_manager.create_session()
            session_id = session.session_id

        # Find skill that provides this tool
        skill = self._find_skill_for_tool(tool_name)

        if skill is None:
            return ToolResponse(
                status="error",
                error=f"No skill provides tool: {tool_name}",
                data={"available_tools": self.get_all_tools()}
            )

        # Execute tool (skill-specific implementation)
        try:
            # Tools are typically registered with MCP server
            # Direct tool execution would require the skill to expose a method
            # For now, we route through the skill's execute method
            task = f"Execute tool {tool_name} with arguments: {arguments}"

            exec_context = ExecutionContext(
                scenario=context.get("scenario", session.current_scenario or ""),
                feature_file=context.get("feature_file", session.feature_file or ""),
                step=context.get("step", ""),
                step_raw=context.get("step_raw", ""),
                caller=context.get("caller", "agent"),
                gen_code_id=context.get("gen_code_id", session.gen_code_id),
            )

            result = await skill.execute(task, exec_context)

            # Record action
            self._context_manager.add_to_context(
                session_id=session_id,
                tool_name=tool_name,
                arguments=arguments,
                result=result.to_dict(),
                step=exec_context.step,
                scenario=exec_context.scenario,
            )

            return result

        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return ToolResponse(
                status="error",
                error=str(e),
                data={"tool": tool_name, "arguments": arguments}
            )

    def _resolve_platform(
        self,
        task: str,
        platform_hint: Optional[str] = None
    ) -> Optional[SkillPlatform]:
        """
        Resolve the target platform for a task.

        Args:
            task: Task description
            platform_hint: Optional platform hint from user

        Returns:
            Detected SkillPlatform or None
        """
        # If platform is explicitly specified
        if platform_hint:
            platform_hint_lower = platform_hint.lower()

            # Try direct enum value match
            for p in SkillPlatform:
                if p.value == platform_hint_lower:
                    return p

            # Try keyword matching
            platform_keywords = {
                SkillPlatform.MOBILE_IOS: ["ios", "iphone", "ipad"],
                SkillPlatform.MOBILE_ANDROID: ["android"],
                SkillPlatform.DESKTOP_WINDOWS: ["windows", "win"],
                SkillPlatform.DESKTOP_MAC: ["mac", "macos", "osx"],
                SkillPlatform.WEB: ["web", "browser"],
            }

            for platform, keywords in platform_keywords.items():
                if any(kw in platform_hint_lower for kw in keywords):
                    return platform

        # Auto-detect from task description
        return self._skill_loader.detect_platform_from_task(task)

    def _find_skill_for_tool(self, tool_name: str) -> Optional[BaseSkill]:
        """
        Find which skill provides a given tool.

        Args:
            tool_name: Name of the tool

        Returns:
            Skill that provides the tool or None
        """
        for skill in self._skills.values():
            if tool_name in skill.get_available_tools():
                return skill
        return None

    def get_all_tools(self) -> List[str]:
        """Get list of all available tools across all skills."""
        tools = []
        for skill in self._skills.values():
            tools.extend(skill.get_available_tools())
        return tools

    def get_skill_by_name(self, name: str) -> Optional[BaseSkill]:
        """Get a loaded skill by name."""
        return self._skills.get(name)

    def get_session(self, session_id: str) -> Optional[SessionContext]:
        """Get a session by ID."""
        return self._context_manager.get_session(session_id)

    def create_session(
        self,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SessionContext:
        """Create a new session."""
        return self._context_manager.create_session(session_id, metadata)

    def set_session_feature(
        self,
        session_id: str,
        feature_file: str,
        gen_code_id: Optional[str] = None
    ) -> None:
        """Set feature file and code generation ID for a session."""
        self._context_manager.set_feature_file(session_id, feature_file)
        if gen_code_id:
            self._context_manager.set_gen_code_id(session_id, gen_code_id)

    def set_session_scenario(self, session_id: str, scenario: str) -> None:
        """Set the current scenario for a session."""
        self._context_manager.set_current_scenario(session_id, scenario)

    async def cleanup(self) -> None:
        """Clean up all resources."""
        logger.info("Cleaning up agent...")

        # Unload all skills
        await self._skill_loader.unload_all_skills()

        # Clear all sessions
        self._context_manager.clear_all_sessions()

        self._skills.clear()
        self._initialized = False

        logger.info("Agent cleanup complete")

    def __repr__(self) -> str:
        status = "initialized" if self._initialized else "not initialized"
        skill_count = len(self._skills)
        return f"AgentCoordinator(status={status}, skills={skill_count})"
