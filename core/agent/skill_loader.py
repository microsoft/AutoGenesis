"""
Skill Loader for AutoGenesis Agent.
Dynamically discovers and loads available testing skills.
"""

import importlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

from skills.base_skill import BaseSkill, SkillPlatform


logger = logging.getLogger(__name__)


# Registry of known skill modules
SKILL_REGISTRY = {
    "mobile_skill": {
        "module": "skills.mobile_skill",
        "class": "MobileSkill",
        "platforms": [SkillPlatform.MOBILE_IOS, SkillPlatform.MOBILE_ANDROID],
    },
    "desktop_windows_skill": {
        "module": "skills.desktop_windows_skill",
        "class": "DesktopWindowsSkill",
        "platforms": [SkillPlatform.DESKTOP_WINDOWS],
    },
    "desktop_mac_skill": {
        "module": "skills.desktop_mac_skill",
        "class": "DesktopMacSkill",
        "platforms": [SkillPlatform.DESKTOP_MAC],
    },
    # Future: web_skill
}


class SkillLoader:
    """
    Dynamically loads and manages testing skills.

    Responsibilities:
    - Discover available skills
    - Load skill modules
    - Instantiate skill classes
    - Validate skill configurations
    """

    def __init__(self, skills_dir: Optional[Path] = None):
        """
        Initialize the skill loader.

        Args:
            skills_dir: Directory containing skill modules (auto-detected if None)
        """
        if skills_dir is None:
            # Auto-detect skills directory relative to this file
            skills_dir = Path(__file__).parent.parent.parent / "skills"
        self.skills_dir = skills_dir
        self._loaded_skills: Dict[str, BaseSkill] = {}

    async def load_all_skills(
        self,
        configs: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, BaseSkill]:
        """
        Load all available skills.

        Args:
            configs: Optional per-skill configurations keyed by skill name

        Returns:
            Dictionary of loaded skills keyed by name
        """
        configs = configs or {}
        loaded = {}

        for skill_name, skill_info in SKILL_REGISTRY.items():
            try:
                skill = await self.load_skill(
                    skill_name,
                    configs.get(skill_name, {})
                )
                if skill:
                    loaded[skill_name] = skill
                    logger.info(f"Loaded skill: {skill_name}")
            except Exception as e:
                logger.warning(f"Failed to load skill {skill_name}: {e}")

        self._loaded_skills = loaded
        return loaded

    async def load_skill(
        self,
        skill_name: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Optional[BaseSkill]:
        """
        Load a specific skill by name.

        Args:
            skill_name: Name of the skill to load
            config: Skill configuration

        Returns:
            Loaded skill instance or None if failed
        """
        if skill_name not in SKILL_REGISTRY:
            logger.error(f"Unknown skill: {skill_name}")
            return None

        skill_info = SKILL_REGISTRY[skill_name]
        module_name = skill_info["module"]
        class_name = skill_info["class"]

        try:
            # Import the module
            module = importlib.import_module(module_name)

            # Get the skill class
            skill_class: Type[BaseSkill] = getattr(module, class_name)

            # Instantiate the skill
            skill = skill_class(config=config or {})

            # Initialize the skill
            if await skill.initialize():
                return skill
            else:
                logger.error(f"Failed to initialize skill: {skill_name}")
                return None

        except ImportError as e:
            logger.warning(f"Could not import skill module {module_name}: {e}")
            return None
        except AttributeError as e:
            logger.error(f"Skill class {class_name} not found in {module_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error loading skill {skill_name}: {e}")
            return None

    def get_skill_for_platform(
        self,
        platform: SkillPlatform
    ) -> Optional[BaseSkill]:
        """
        Get a loaded skill that supports the given platform.

        Args:
            platform: Target platform

        Returns:
            Skill supporting the platform or None
        """
        for skill in self._loaded_skills.values():
            if skill.supports_platform(platform):
                return skill
        return None

    def get_skills_for_platform(
        self,
        platform: SkillPlatform
    ) -> List[BaseSkill]:
        """
        Get all loaded skills that support the given platform.

        Args:
            platform: Target platform

        Returns:
            List of skills supporting the platform
        """
        return [
            skill for skill in self._loaded_skills.values()
            if skill.supports_platform(platform)
        ]

    def get_loaded_skills(self) -> Dict[str, BaseSkill]:
        """Get all currently loaded skills."""
        return self._loaded_skills.copy()

    def get_skill_by_name(self, name: str) -> Optional[BaseSkill]:
        """Get a loaded skill by name."""
        return self._loaded_skills.get(name)

    async def unload_all_skills(self) -> None:
        """Unload and cleanup all loaded skills."""
        for skill_name, skill in self._loaded_skills.items():
            try:
                await skill.cleanup()
                logger.info(f"Unloaded skill: {skill_name}")
            except Exception as e:
                logger.error(f"Error unloading skill {skill_name}: {e}")

        self._loaded_skills.clear()

    def detect_platform_from_task(self, task: str) -> Optional[SkillPlatform]:
        """
        Attempt to detect the target platform from a task description.

        Args:
            task: Natural language task description

        Returns:
            Detected platform or None if ambiguous
        """
        task_lower = task.lower()

        # Mobile platforms
        if any(kw in task_lower for kw in ["ios", "iphone", "ipad"]):
            return SkillPlatform.MOBILE_IOS
        if any(kw in task_lower for kw in ["android"]):
            return SkillPlatform.MOBILE_ANDROID

        # Desktop platforms
        if any(kw in task_lower for kw in ["windows", "win32", "win64"]):
            return SkillPlatform.DESKTOP_WINDOWS
        if any(kw in task_lower for kw in ["mac", "macos", "osx"]):
            return SkillPlatform.DESKTOP_MAC

        # Web platform
        if any(kw in task_lower for kw in ["browser", "web", "chrome", "firefox", "safari", "edge"]):
            return SkillPlatform.WEB

        return None
