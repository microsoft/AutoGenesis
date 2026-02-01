"""
Failure Classifier for AutoGenesis.

Analyzes test failures and classifies them into categories:
- SCRIPT_ISSUE: Test script problems (can be auto-healed)
- PRODUCT_BUG: Product defects
- ENVIRONMENT: Environment/infrastructure issues
- UNDETERMINED: Cannot determine the cause
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from core.utils.logger import get_mcp_logger


logger = get_mcp_logger()


class FailureType(Enum):
    """Enumeration of failure types."""
    SCRIPT_ISSUE = "script_issue"      # Script problems (auto-healable)
    PRODUCT_BUG = "product_bug"        # Product defects
    ENVIRONMENT = "environment"        # Environment/infra issues
    UNDETERMINED = "undetermined"      # Cannot determine


@dataclass
class FailureEvidence:
    """Evidence supporting a failure classification."""
    type: str  # "error_pattern", "ui_diff", "screenshot_analysis", etc.
    description: str
    confidence: float  # 0.0 - 1.0
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FailureClassification:
    """Result of failure classification."""
    failure_type: FailureType
    confidence: float  # 0.0 - 1.0
    reason: str
    evidence: List[FailureEvidence] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    healable: bool = False


class FailureClassifier:
    """
    Analyzes test failures and classifies them.

    Uses a combination of:
    1. Rule-based pattern matching (fast, no LLM)
    2. LLM-based deep analysis (when confidence is low)
    """

    # Error patterns that indicate environment issues
    ENVIRONMENT_PATTERNS = [
        (r"connection\s*(refused|reset|timed?\s*out)", "Network connectivity issue"),
        (r"timeout.*waiting", "Operation timeout"),
        (r"session\s*(not\s*created|expired|invalid)", "Session management issue"),
        (r"could\s*not\s*(connect|reach|start)", "Service connectivity issue"),
        (r"appium.*server.*not.*running", "Appium server not running"),
        (r"device\s*(not\s*found|disconnected|offline)", "Device connectivity issue"),
        (r"(memory|disk|cpu)\s*(full|exhausted|insufficient)", "Resource exhaustion"),
        (r"permission\s*denied", "Permission issue"),
        (r"browserstack.*error", "Cloud testing service issue"),
    ]

    # Error patterns that indicate script issues (potentially healable)
    SCRIPT_ISSUE_PATTERNS = [
        (r"element\s*(not\s*found|not\s*visible|not\s*interactable)", "Element locator issue"),
        (r"stale\s*element", "Stale element reference"),
        (r"no\s*such\s*element", "Element not found"),
        (r"(xpath|id|accessibility.id|name|class).*not\s*found", "Locator strategy issue"),
        (r"invalid\s*selector", "Invalid locator syntax"),
        (r"element.*not.*clickable", "Element not ready for interaction"),
        (r"element.*obscured", "Element covered by another element"),
        (r"wait.*condition.*not.*met", "Wait condition not satisfied"),
    ]

    # Error patterns that indicate product bugs
    PRODUCT_BUG_PATTERNS = [
        (r"assert(ion)?.*fail", "Assertion failure"),
        (r"expected.*but.*got", "Value mismatch"),
        (r"crash|fatal|exception\s*occurred", "Application crash"),
        (r"unexpected\s*(state|behavior|result)", "Unexpected behavior"),
        (r"(text|value|content).*mismatch", "Content verification failure"),
    ]

    def __init__(self, llm_client=None):
        """
        Initialize the failure classifier.

        Args:
            llm_client: Optional LLM client for deep analysis.
        """
        self.llm_client = llm_client

    def classify(
        self,
        error_message: str,
        current_ui_tree: Optional[str] = None,
        recorded_ui_tree: Optional[str] = None,
        failed_step: Optional[str] = None,
        screenshot_path: Optional[str] = None,
        use_llm: bool = False
    ) -> FailureClassification:
        """
        Classify a test failure.

        Args:
            error_message: The error message from the failure.
            current_ui_tree: Current page source/UI tree.
            recorded_ui_tree: Original recorded UI tree (if available).
            failed_step: The BDD step that failed.
            screenshot_path: Path to screenshot at failure.
            use_llm: Whether to use LLM for deep analysis.

        Returns:
            FailureClassification with type, confidence, and evidence.
        """
        logger.info(f"Classifying failure: {error_message[:100]}...")

        # Step 1: Rule-based classification
        classification = self._rule_based_classify(error_message)

        # Step 2: UI tree comparison (if available)
        if current_ui_tree and recorded_ui_tree:
            ui_evidence = self._analyze_ui_diff(
                current_ui_tree, recorded_ui_tree, failed_step
            )
            if ui_evidence:
                classification.evidence.append(ui_evidence)
                # Adjust confidence based on UI analysis
                if ui_evidence.confidence > 0.7:
                    if classification.failure_type == FailureType.UNDETERMINED:
                        classification.failure_type = FailureType.SCRIPT_ISSUE
                        classification.confidence = ui_evidence.confidence
                        classification.healable = True

        # Step 3: Element existence check
        if current_ui_tree and failed_step:
            element_evidence = self._check_element_existence(
                current_ui_tree, failed_step, error_message
            )
            if element_evidence:
                classification.evidence.append(element_evidence)

        # Step 4: LLM deep analysis (if confidence is low and LLM enabled)
        if use_llm and self.llm_client and classification.confidence < 0.7:
            llm_result = self._llm_deep_analysis(
                error_message,
                current_ui_tree,
                recorded_ui_tree,
                failed_step,
                screenshot_path
            )
            if llm_result:
                # Merge LLM analysis with rule-based
                classification = self._merge_classifications(classification, llm_result)

        # Generate suggestions based on failure type
        classification.suggestions = self._generate_suggestions(classification)

        logger.info(
            f"Classification: {classification.failure_type.value} "
            f"(confidence: {classification.confidence:.2f})"
        )

        return classification

    def _rule_based_classify(self, error_message: str) -> FailureClassification:
        """
        Perform rule-based classification using error patterns.

        Args:
            error_message: The error message to classify.

        Returns:
            Initial classification based on patterns.
        """
        error_lower = error_message.lower()
        evidence = []

        # Check environment patterns
        for pattern, description in self.ENVIRONMENT_PATTERNS:
            if re.search(pattern, error_lower, re.IGNORECASE):
                evidence.append(FailureEvidence(
                    type="error_pattern",
                    description=description,
                    confidence=0.85,
                    details={"pattern": pattern, "matched": True}
                ))
                return FailureClassification(
                    failure_type=FailureType.ENVIRONMENT,
                    confidence=0.85,
                    reason=f"Error matches environment issue pattern: {description}",
                    evidence=evidence,
                    healable=False
                )

        # Check script issue patterns
        for pattern, description in self.SCRIPT_ISSUE_PATTERNS:
            if re.search(pattern, error_lower, re.IGNORECASE):
                evidence.append(FailureEvidence(
                    type="error_pattern",
                    description=description,
                    confidence=0.80,
                    details={"pattern": pattern, "matched": True}
                ))
                return FailureClassification(
                    failure_type=FailureType.SCRIPT_ISSUE,
                    confidence=0.80,
                    reason=f"Error matches script issue pattern: {description}",
                    evidence=evidence,
                    healable=True
                )

        # Check product bug patterns
        for pattern, description in self.PRODUCT_BUG_PATTERNS:
            if re.search(pattern, error_lower, re.IGNORECASE):
                evidence.append(FailureEvidence(
                    type="error_pattern",
                    description=description,
                    confidence=0.75,
                    details={"pattern": pattern, "matched": True}
                ))
                return FailureClassification(
                    failure_type=FailureType.PRODUCT_BUG,
                    confidence=0.75,
                    reason=f"Error matches product bug pattern: {description}",
                    evidence=evidence,
                    healable=False
                )

        # No pattern matched
        return FailureClassification(
            failure_type=FailureType.UNDETERMINED,
            confidence=0.3,
            reason="Error does not match any known pattern",
            evidence=[],
            healable=False
        )

    def _analyze_ui_diff(
        self,
        current_ui: str,
        recorded_ui: str,
        failed_step: Optional[str]
    ) -> Optional[FailureEvidence]:
        """
        Analyze differences between current and recorded UI trees.

        Args:
            current_ui: Current page source.
            recorded_ui: Recorded page source.
            failed_step: The failed BDD step.

        Returns:
            Evidence from UI diff analysis, or None.
        """
        try:
            # Simple heuristic: check if page structure changed significantly
            current_elements = set(re.findall(r'(?:name|label|identifier)="([^"]+)"', current_ui))
            recorded_elements = set(re.findall(r'(?:name|label|identifier)="([^"]+)"', recorded_ui))

            missing_elements = recorded_elements - current_elements
            new_elements = current_elements - recorded_elements

            if missing_elements:
                # Elements from recorded UI are missing
                return FailureEvidence(
                    type="ui_diff",
                    description=f"UI structure changed: {len(missing_elements)} elements missing",
                    confidence=0.75,
                    details={
                        "missing_elements": list(missing_elements)[:10],  # Limit to 10
                        "new_elements": list(new_elements)[:10],
                        "total_missing": len(missing_elements),
                        "total_new": len(new_elements)
                    }
                )

            return None

        except Exception as e:
            logger.warning(f"Error analyzing UI diff: {e}")
            return None

    def _check_element_existence(
        self,
        current_ui: str,
        failed_step: str,
        error_message: str
    ) -> Optional[FailureEvidence]:
        """
        Check if the target element exists in current UI.

        Args:
            current_ui: Current page source.
            failed_step: The failed BDD step.
            error_message: The error message.

        Returns:
            Evidence from element check, or None.
        """
        try:
            # Extract potential element identifiers from error and step
            identifiers = []

            # Look for quoted strings that might be element identifiers
            for text in [error_message, failed_step]:
                identifiers.extend(re.findall(r'"([^"]+)"', text))
                identifiers.extend(re.findall(r"'([^']+)'", text))

            # Look for locator patterns
            locator_patterns = [
                r"accessibility_id:(\S+)",
                r"id:(\S+)",
                r"name:(\S+)",
                r"xpath:([^\s]+)",
            ]
            for pattern in locator_patterns:
                for text in [error_message, failed_step]:
                    match = re.search(pattern, text)
                    if match:
                        identifiers.append(match.group(1))

            # Check if any identifier exists in current UI
            for identifier in identifiers:
                if identifier in current_ui:
                    return FailureEvidence(
                        type="element_check",
                        description=f"Element '{identifier}' found in current UI",
                        confidence=0.6,
                        details={"identifier": identifier, "found": True}
                    )

            if identifiers:
                return FailureEvidence(
                    type="element_check",
                    description=f"Target elements not found in current UI",
                    confidence=0.7,
                    details={"identifiers": identifiers[:5], "found": False}
                )

            return None

        except Exception as e:
            logger.warning(f"Error checking element existence: {e}")
            return None

    def _llm_deep_analysis(
        self,
        error_message: str,
        current_ui: Optional[str],
        recorded_ui: Optional[str],
        failed_step: Optional[str],
        screenshot_path: Optional[str]
    ) -> Optional[FailureClassification]:
        """
        Perform deep analysis using LLM.

        Args:
            error_message: The error message.
            current_ui: Current page source.
            recorded_ui: Recorded page source.
            failed_step: The failed BDD step.
            screenshot_path: Path to failure screenshot.

        Returns:
            LLM-based classification, or None if analysis fails.
        """
        if not self.llm_client:
            return None

        try:
            # Build context for LLM
            context = f"""Analyze this test failure and classify it:

Error Message:
{error_message}

Failed Step:
{failed_step or 'Not provided'}

Current UI Elements (sample):
{current_ui[:2000] if current_ui else 'Not provided'}

Original UI Elements (sample):
{recorded_ui[:2000] if recorded_ui else 'Not provided'}

Classify this failure as one of:
1. SCRIPT_ISSUE - The test script has a problem (element locator changed, timing issue, etc.)
2. PRODUCT_BUG - The product has a defect (wrong behavior, crash, etc.)
3. ENVIRONMENT - Environment/infrastructure issue (network, device, server, etc.)
4. UNDETERMINED - Cannot determine the cause

Respond in JSON format:
{{
    "failure_type": "SCRIPT_ISSUE|PRODUCT_BUG|ENVIRONMENT|UNDETERMINED",
    "confidence": 0.0-1.0,
    "reason": "detailed explanation",
    "healable": true/false
}}
"""
            # Call LLM (placeholder - actual implementation depends on LLM client)
            # response = self.llm_client.chat(context)
            # result = json.loads(response)

            logger.info("LLM deep analysis not implemented yet")
            return None

        except Exception as e:
            logger.warning(f"Error in LLM deep analysis: {e}")
            return None

    def _merge_classifications(
        self,
        rule_based: FailureClassification,
        llm_based: FailureClassification
    ) -> FailureClassification:
        """
        Merge rule-based and LLM-based classifications.

        Args:
            rule_based: Classification from rules.
            llm_based: Classification from LLM.

        Returns:
            Merged classification.
        """
        # If LLM has higher confidence, prefer LLM result
        if llm_based.confidence > rule_based.confidence:
            merged = llm_based
            merged.evidence.extend(rule_based.evidence)
        else:
            merged = rule_based
            merged.evidence.extend(llm_based.evidence)

        return merged

    def _generate_suggestions(
        self,
        classification: FailureClassification
    ) -> List[str]:
        """
        Generate actionable suggestions based on classification.

        Args:
            classification: The failure classification.

        Returns:
            List of suggestions.
        """
        suggestions = []

        if classification.failure_type == FailureType.SCRIPT_ISSUE:
            suggestions.extend([
                "Run script healer to auto-fix the locator",
                "Check if the UI has been updated in the latest build",
                "Verify the element locator strategy",
                "Add explicit wait before the failed step",
            ])
        elif classification.failure_type == FailureType.PRODUCT_BUG:
            suggestions.extend([
                "Report this as a product defect",
                "Capture detailed logs for bug report",
                "Verify the expected behavior in requirements",
            ])
        elif classification.failure_type == FailureType.ENVIRONMENT:
            suggestions.extend([
                "Check network connectivity",
                "Verify Appium server is running",
                "Check device/emulator status",
                "Retry after environment stabilizes",
            ])
        else:
            suggestions.extend([
                "Manual investigation required",
                "Collect more evidence for classification",
                "Run with verbose logging enabled",
            ])

        return suggestions
