"""
Base Skill abstract class for AutoGenesis.
All platform-specific skills must implement this interface.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import logging
from pathlib import Path


logger = logging.getLogger(__name__)


class SkillPlatform(Enum):
    """Supported platforms for testing skills."""
    MOBILE_IOS = "ios"
    MOBILE_ANDROID = "android"
    DESKTOP_WINDOWS = "windows"
    DESKTOP_MAC = "mac"
    WEB = "web"


@dataclass
class SkillManifest:
    """Metadata describing a skill's capabilities."""
    name: str
    version: str
    description: str
    platforms: List[SkillPlatform]
    capabilities: List[str]
    tools: List[Dict[str, Any]]
    dependencies: Dict[str, str] = field(default_factory=dict)
    config_schema: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_json(cls, json_path: Path) -> "SkillManifest":
        """Load manifest from a JSON file."""
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Convert platform strings to enum
        platforms = [SkillPlatform(p) for p in data.get("platforms", [])]

        return cls(
            name=data["name"],
            version=data["version"],
            description=data["description"],
            platforms=platforms,
            capabilities=data.get("capabilities", []),
            tools=data.get("tools", []),
            dependencies=data.get("dependencies", {}),
            config_schema=data.get("config_schema", {}),
        )


@dataclass
class ToolResponse:
    """Standardized response from tool execution."""
    status: str  # "success", "error", "failed"
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"status": self.status, "data": self.data}
        if self.error:
            result["error"] = self.error
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @property
    def is_success(self) -> bool:
        return self.status == "success"


@dataclass
class ExecutionContext:
    """Context for skill execution."""
    scenario: str = ""
    feature_file: str = ""
    step: str = ""
    step_raw: str = ""
    caller: str = ""
    gen_code_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario": self.scenario,
            "feature_file": self.feature_file,
            "step": self.step,
            "step_raw": self.step_raw,
            "caller": self.caller,
            "gen_code_id": self.gen_code_id,
        }


class BaseSkill(ABC):
    """
    Abstract base class for all testing skills.

    All skills must implement this interface to be compatible with the
    AutoGenesis agent. Skills encapsulate platform-specific automation
    capabilities (mobile, desktop, web).

    Lifecycle:
    1. __init__: Basic initialization with config
    2. initialize(): Async setup (load drivers, start sessions)
    3. execute()/call tool methods: Execute test operations
    4. cleanup(): Release resources
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the skill with optional configuration.

        Args:
            config: Platform-specific configuration dictionary
        """
        self.config = config or {}
        self._manifest: Optional[SkillManifest] = None
        self._tools: Dict[str, Any] = {}
        self._initialized = False

    @property
    def manifest(self) -> SkillManifest:
        """Get the skill manifest. Loads from file if not cached."""
        if self._manifest is None:
            self._manifest = self._load_manifest()
        return self._manifest

    @property
    def name(self) -> str:
        """Get the skill name."""
        return self.manifest.name

    @property
    def platforms(self) -> List[SkillPlatform]:
        """Get supported platforms."""
        return self.manifest.platforms

    @property
    def is_initialized(self) -> bool:
        """Check if skill has been initialized."""
        return self._initialized

    @abstractmethod
    def _load_manifest(self) -> SkillManifest:
        """
        Load the skill manifest describing capabilities.

        Returns:
            SkillManifest containing skill metadata and tool definitions
        """
        pass

    @abstractmethod
    async def initialize(self) -> bool:
        """
        Initialize the skill (load drivers, start sessions, etc.).

        This is called once before the skill is used. Implementations
        should set up any required connections or resources.

        Returns:
            True if initialization successful, False otherwise
        """
        pass

    @abstractmethod
    async def execute(self, task: str, context: ExecutionContext) -> ToolResponse:
        """
        Execute a task using this skill.

        This is the main entry point for natural language task execution.
        The skill should interpret the task and call appropriate tools.

        Args:
            task: Natural language task description
            context: Execution context (scenario, step info, etc.)

        Returns:
            ToolResponse with status, data, and any generated code info
        """
        pass

    @abstractmethod
    def get_available_tools(self) -> List[str]:
        """
        Get list of MCP tool names this skill provides.

        Returns:
            List of tool function names available for MCP registration
        """
        pass

    @abstractmethod
    def register_tools(self, mcp_server: Any, session_manager: Any) -> None:
        """
        Register all skill tools with the MCP server.

        Args:
            mcp_server: FastMCP server instance
            session_manager: Session manager for the skill
        """
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """
        Clean up resources (close sessions, drivers, etc.).

        Called when the skill is being shut down. Implementations
        should release any held resources.
        """
        pass

    def supports_platform(self, platform: SkillPlatform) -> bool:
        """
        Check if this skill supports a given platform.

        Args:
            platform: Platform to check

        Returns:
            True if platform is supported
        """
        return platform in self.platforms

    def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific tool.

        Args:
            tool_name: Name of the tool

        Returns:
            Tool metadata dict or None if not found
        """
        for tool in self.manifest.tools:
            if tool.get("name") == tool_name:
                return tool
        return None

    def validate_config(self) -> List[str]:
        """
        Validate the current configuration against the schema.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []
        schema = self.manifest.config_schema

        for field_name, field_spec in schema.items():
            if field_spec.get("required", False):
                if field_name not in self.config:
                    errors.append(f"Required config field missing: {field_name}")

        return errors

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name}, platforms={[p.value for p in self.platforms]})"
