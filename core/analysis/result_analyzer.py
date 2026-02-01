"""
Result Analyzer for AutoGenesis.

Analyzes Behave test execution results and provides comprehensive failure analysis.
"""

import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from core.analysis.failure_classifier import (
    FailureClassification,
    FailureClassifier,
    FailureType,
)
from core.utils.logger import get_mcp_logger


logger = get_mcp_logger()


@dataclass
class StepResult:
    """Result of a single BDD step execution."""
    step_text: str
    status: str  # "passed", "failed", "skipped", "undefined"
    duration: float = 0.0
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    ui_tree: Optional[str] = None
    classification: Optional[FailureClassification] = None


@dataclass
class ScenarioResult:
    """Result of a BDD scenario execution."""
    name: str
    feature_file: str
    status: str  # "passed", "failed", "skipped"
    steps: List[StepResult] = field(default_factory=list)
    duration: float = 0.0
    tags: List[str] = field(default_factory=list)


@dataclass
class FeatureResult:
    """Result of a BDD feature execution."""
    name: str
    file_path: str
    scenarios: List[ScenarioResult] = field(default_factory=list)
    duration: float = 0.0


@dataclass
class AnalysisReport:
    """Comprehensive analysis report for test execution."""
    timestamp: str
    total_features: int = 0
    total_scenarios: int = 0
    total_steps: int = 0
    passed_scenarios: int = 0
    failed_scenarios: int = 0
    skipped_scenarios: int = 0
    features: List[FeatureResult] = field(default_factory=list)
    failure_summary: Dict[str, int] = field(default_factory=dict)
    healable_failures: List[Dict[str, Any]] = field(default_factory=list)
    product_bugs: List[Dict[str, Any]] = field(default_factory=list)
    environment_issues: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary."""
        return {
            "timestamp": self.timestamp,
            "summary": {
                "total_features": self.total_features,
                "total_scenarios": self.total_scenarios,
                "total_steps": self.total_steps,
                "passed_scenarios": self.passed_scenarios,
                "failed_scenarios": self.failed_scenarios,
                "skipped_scenarios": self.skipped_scenarios,
            },
            "failure_summary": self.failure_summary,
            "healable_failures": self.healable_failures,
            "product_bugs": self.product_bugs,
            "environment_issues": self.environment_issues,
        }

    def to_json(self, indent: int = 2) -> str:
        """Convert report to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)


class ResultAnalyzer:
    """
    Analyzes test execution results and provides failure insights.

    Features:
    - Parse Behave JSON reports
    - Classify failures using FailureClassifier
    - Identify healable failures for auto-fix
    - Generate comprehensive analysis reports
    """

    def __init__(
        self,
        classifier: Optional[FailureClassifier] = None,
        screenshots_dir: Optional[str] = None,
        ui_trees_dir: Optional[str] = None
    ):
        """
        Initialize the result analyzer.

        Args:
            classifier: Optional failure classifier instance.
            screenshots_dir: Directory containing failure screenshots.
            ui_trees_dir: Directory containing UI tree dumps.
        """
        self.classifier = classifier or FailureClassifier()
        self.screenshots_dir = screenshots_dir
        self.ui_trees_dir = ui_trees_dir

    def analyze_behave_json(
        self,
        json_report_path: str,
        recorded_ui_trees: Optional[Dict[str, str]] = None
    ) -> AnalysisReport:
        """
        Analyze a Behave JSON report.

        Args:
            json_report_path: Path to Behave JSON report.
            recorded_ui_trees: Dict mapping step names to recorded UI trees.

        Returns:
            AnalysisReport with comprehensive analysis.
        """
        logger.info(f"Analyzing Behave report: {json_report_path}")

        with open(json_report_path, 'r', encoding='utf-8') as f:
            behave_data = json.load(f)

        report = AnalysisReport(
            timestamp=datetime.now().isoformat()
        )

        for feature_data in behave_data:
            feature_result = self._analyze_feature(
                feature_data, recorded_ui_trees or {}
            )
            report.features.append(feature_result)

        # Calculate totals
        self._calculate_totals(report)

        return report

    def analyze_failure(
        self,
        feature_file: str,
        scenario_name: str,
        failed_step: str,
        error_message: str,
        current_ui_tree: Optional[str] = None,
        recorded_ui_tree: Optional[str] = None,
        screenshot_path: Optional[str] = None
    ) -> FailureClassification:
        """
        Analyze a single test failure.

        Args:
            feature_file: Path to the feature file.
            scenario_name: Name of the failed scenario.
            failed_step: The step that failed.
            error_message: Error message from the failure.
            current_ui_tree: Current page source.
            recorded_ui_tree: Original recorded UI tree.
            screenshot_path: Path to failure screenshot.

        Returns:
            FailureClassification with analysis results.
        """
        logger.info(f"Analyzing failure in scenario: {scenario_name}")

        classification = self.classifier.classify(
            error_message=error_message,
            current_ui_tree=current_ui_tree,
            recorded_ui_tree=recorded_ui_tree,
            failed_step=failed_step,
            screenshot_path=screenshot_path
        )

        return classification

    def _analyze_feature(
        self,
        feature_data: Dict[str, Any],
        recorded_ui_trees: Dict[str, str]
    ) -> FeatureResult:
        """
        Analyze a single feature from Behave data.

        Args:
            feature_data: Feature data from Behave JSON.
            recorded_ui_trees: Recorded UI trees for steps.

        Returns:
            FeatureResult with analysis.
        """
        feature = FeatureResult(
            name=feature_data.get("name", "Unknown"),
            file_path=feature_data.get("location", ""),
        )

        elements = feature_data.get("elements", [])
        for element in elements:
            if element.get("type") == "scenario":
                scenario_result = self._analyze_scenario(
                    element, feature.file_path, recorded_ui_trees
                )
                feature.scenarios.append(scenario_result)
                feature.duration += scenario_result.duration

        return feature

    def _analyze_scenario(
        self,
        scenario_data: Dict[str, Any],
        feature_file: str,
        recorded_ui_trees: Dict[str, str]
    ) -> ScenarioResult:
        """
        Analyze a single scenario from Behave data.

        Args:
            scenario_data: Scenario data from Behave JSON.
            feature_file: Path to the feature file.
            recorded_ui_trees: Recorded UI trees for steps.

        Returns:
            ScenarioResult with analysis.
        """
        scenario = ScenarioResult(
            name=scenario_data.get("name", "Unknown"),
            feature_file=feature_file,
            status="passed",
            tags=scenario_data.get("tags", []),
        )

        steps = scenario_data.get("steps", [])
        for step_data in steps:
            step_result = self._analyze_step(
                step_data, scenario.name, recorded_ui_trees
            )
            scenario.steps.append(step_result)
            scenario.duration += step_result.duration

            # Update scenario status
            if step_result.status == "failed":
                scenario.status = "failed"
            elif step_result.status == "skipped" and scenario.status == "passed":
                scenario.status = "skipped"

        return scenario

    def _analyze_step(
        self,
        step_data: Dict[str, Any],
        scenario_name: str,
        recorded_ui_trees: Dict[str, str]
    ) -> StepResult:
        """
        Analyze a single step from Behave data.

        Args:
            step_data: Step data from Behave JSON.
            scenario_name: Name of the parent scenario.
            recorded_ui_trees: Recorded UI trees.

        Returns:
            StepResult with analysis.
        """
        keyword = step_data.get("keyword", "")
        name = step_data.get("name", "")
        step_text = f"{keyword}{name}"

        result_data = step_data.get("result", {})
        status = result_data.get("status", "undefined")
        duration = result_data.get("duration", 0.0)
        error_message = result_data.get("error_message")

        step_result = StepResult(
            step_text=step_text,
            status=status,
            duration=duration,
            error_message=error_message,
        )

        # Load screenshot if available
        if self.screenshots_dir and status == "failed":
            screenshot_path = self._find_screenshot(scenario_name, step_text)
            step_result.screenshot_path = screenshot_path

        # Load current UI tree if available
        if self.ui_trees_dir and status == "failed":
            ui_tree = self._load_ui_tree(scenario_name, step_text)
            step_result.ui_tree = ui_tree

        # Classify failure
        if status == "failed" and error_message:
            recorded_ui = recorded_ui_trees.get(step_text)
            classification = self.classifier.classify(
                error_message=error_message,
                current_ui_tree=step_result.ui_tree,
                recorded_ui_tree=recorded_ui,
                failed_step=step_text,
                screenshot_path=step_result.screenshot_path
            )
            step_result.classification = classification

        return step_result

    def _find_screenshot(
        self,
        scenario_name: str,
        step_text: str
    ) -> Optional[str]:
        """
        Find screenshot for a failed step.

        Args:
            scenario_name: Scenario name.
            step_text: Step text.

        Returns:
            Path to screenshot if found.
        """
        if not self.screenshots_dir:
            return None

        screenshots_path = Path(self.screenshots_dir)
        if not screenshots_path.exists():
            return None

        # Try common naming patterns
        patterns = [
            f"{scenario_name}*.png",
            f"*{step_text[:30]}*.png",
            "failure_*.png",
        ]

        for pattern in patterns:
            matches = list(screenshots_path.glob(pattern))
            if matches:
                return str(matches[0])

        return None

    def _load_ui_tree(
        self,
        scenario_name: str,
        step_text: str
    ) -> Optional[str]:
        """
        Load UI tree dump for a failed step.

        Args:
            scenario_name: Scenario name.
            step_text: Step text.

        Returns:
            UI tree content if found.
        """
        if not self.ui_trees_dir:
            return None

        ui_trees_path = Path(self.ui_trees_dir)
        if not ui_trees_path.exists():
            return None

        # Try common naming patterns
        patterns = [
            f"{scenario_name}*.xml",
            f"*{step_text[:30]}*.xml",
            "page_source_*.xml",
        ]

        for pattern in patterns:
            matches = list(ui_trees_path.glob(pattern))
            if matches:
                try:
                    return matches[0].read_text(encoding='utf-8')
                except Exception as e:
                    logger.warning(f"Error reading UI tree: {e}")

        return None

    def _calculate_totals(self, report: AnalysisReport) -> None:
        """
        Calculate summary totals for the report.

        Args:
            report: The report to update.
        """
        report.total_features = len(report.features)

        failure_counts = {
            FailureType.SCRIPT_ISSUE.value: 0,
            FailureType.PRODUCT_BUG.value: 0,
            FailureType.ENVIRONMENT.value: 0,
            FailureType.UNDETERMINED.value: 0,
        }

        for feature in report.features:
            for scenario in feature.scenarios:
                report.total_scenarios += 1
                report.total_steps += len(scenario.steps)

                if scenario.status == "passed":
                    report.passed_scenarios += 1
                elif scenario.status == "failed":
                    report.failed_scenarios += 1
                    # Collect failure details
                    for step in scenario.steps:
                        if step.classification:
                            failure_type = step.classification.failure_type.value
                            failure_counts[failure_type] += 1

                            failure_info = {
                                "feature": feature.name,
                                "scenario": scenario.name,
                                "step": step.step_text,
                                "error": step.error_message,
                                "classification": failure_type,
                                "confidence": step.classification.confidence,
                                "suggestions": step.classification.suggestions,
                            }

                            if step.classification.healable:
                                report.healable_failures.append(failure_info)
                            elif step.classification.failure_type == FailureType.PRODUCT_BUG:
                                report.product_bugs.append(failure_info)
                            elif step.classification.failure_type == FailureType.ENVIRONMENT:
                                report.environment_issues.append(failure_info)
                else:
                    report.skipped_scenarios += 1

        report.failure_summary = failure_counts

    def generate_markdown_report(self, report: AnalysisReport) -> str:
        """
        Generate a Markdown format report.

        Args:
            report: The analysis report.

        Returns:
            Markdown formatted report string.
        """
        lines = [
            "# AutoGenesis Test Analysis Report",
            "",
            f"**Generated:** {report.timestamp}",
            "",
            "## Summary",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total Features | {report.total_features} |",
            f"| Total Scenarios | {report.total_scenarios} |",
            f"| Passed | {report.passed_scenarios} |",
            f"| Failed | {report.failed_scenarios} |",
            f"| Skipped | {report.skipped_scenarios} |",
            "",
        ]

        # Failure breakdown
        if report.failure_summary:
            lines.extend([
                "## Failure Breakdown",
                "",
                "| Type | Count |",
                "|------|-------|",
            ])
            for failure_type, count in report.failure_summary.items():
                if count > 0:
                    lines.append(f"| {failure_type} | {count} |")
            lines.append("")

        # Healable failures
        if report.healable_failures:
            lines.extend([
                "## Healable Failures (Auto-Fix Candidates)",
                "",
            ])
            for i, failure in enumerate(report.healable_failures, 1):
                lines.extend([
                    f"### {i}. {failure['scenario']}",
                    f"- **Step:** {failure['step']}",
                    f"- **Error:** {failure['error'][:200]}...",
                    f"- **Confidence:** {failure['confidence']:.0%}",
                    f"- **Suggestions:**",
                ])
                for suggestion in failure.get('suggestions', []):
                    lines.append(f"  - {suggestion}")
                lines.append("")

        # Product bugs
        if report.product_bugs:
            lines.extend([
                "## Product Bugs Detected",
                "",
            ])
            for i, bug in enumerate(report.product_bugs, 1):
                lines.extend([
                    f"### BUG-{i:03d}: {bug['scenario']}",
                    f"- **Feature:** {bug['feature']}",
                    f"- **Step:** {bug['step']}",
                    f"- **Error:** {bug['error'][:200]}...",
                    "",
                ])

        # Environment issues
        if report.environment_issues:
            lines.extend([
                "## Environment Issues",
                "",
            ])
            for issue in report.environment_issues:
                lines.extend([
                    f"- **{issue['scenario']}**: {issue['error'][:100]}...",
                ])
            lines.append("")

        return "\n".join(lines)
