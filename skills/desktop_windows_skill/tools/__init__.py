"""
Desktop Windows Skill Tools Package.
Contains common and verification tools for Windows desktop automation.
"""

from skills.desktop_windows_skill.tools.common_tools import register_common_tools
from skills.desktop_windows_skill.tools.verify_tools import register_verify_tools

__all__ = [
    "register_common_tools",
    "register_verify_tools",
]
