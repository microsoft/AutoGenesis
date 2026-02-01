"""
Core LLM integration module for AutoGenesis.
Provides unified access to various LLM providers for AI-powered testing.
"""

from core.llm.chat import LLMClient, is_ai_enabled
from core.llm.prompt import img_task_prompt, ImgTaskResponse

__all__ = [
    "LLMClient",
    "is_ai_enabled",
    "img_task_prompt",
    "ImgTaskResponse",
]
