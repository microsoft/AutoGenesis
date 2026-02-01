"""
Analysis Module for AutoGenesis.

Provides test failure analysis, classification, and self-healing capabilities.
"""

from core.analysis.failure_classifier import (
    FailureClassifier,
    FailureClassification,
    FailureEvidence,
    FailureType,
)
from core.analysis.result_analyzer import (
    AnalysisReport,
    FeatureResult,
    ResultAnalyzer,
    ScenarioResult,
    StepResult,
)
from core.analysis.script_healer import (
    CodeFix,
    HealingResult,
    LocatorSuggestion,
    ScriptHealer,
)

__all__ = [
    # Failure classifier
    "FailureClassifier",
    "FailureClassification",
    "FailureEvidence",
    "FailureType",
    # Result analyzer
    "AnalysisReport",
    "FeatureResult",
    "ResultAnalyzer",
    "ScenarioResult",
    "StepResult",
    # Script healer
    "CodeFix",
    "HealingResult",
    "LocatorSuggestion",
    "ScriptHealer",
]
