"""
Script Healer for AutoGenesis.

Automatically heals (fixes) test scripts when locators or other elements change.
Uses Git-based workflow for safe confirmation of changes.
"""

import difflib
import json
import logging
import os
import re
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from core.analysis.failure_classifier import (
    FailureClassification,
    FailureType,
)
from core.utils.logger import get_mcp_logger


logger = get_mcp_logger()


@dataclass
class LocatorSuggestion:
    """A suggested alternative locator."""
    locator: str
    strategy: str  # "accessibility_id", "xpath", "id", "name", etc.
    confidence: float  # 0.0 - 1.0
    element_info: Dict[str, Any] = field(default_factory=dict)
    reason: str = ""


@dataclass
class CodeFix:
    """A proposed code fix."""
    file_path: str
    line_number: int
    original_code: str
    fixed_code: str
    fix_type: str  # "locator_update", "add_wait", "change_strategy", etc.
    confidence: float
    description: str


@dataclass
class HealingResult:
    """Result of a healing attempt."""
    success: bool
    fixes: List[CodeFix] = field(default_factory=list)
    git_branch: Optional[str] = None
    error: Optional[str] = None
    verification_status: Optional[str] = None  # "pending", "passed", "failed"


class ScriptHealer:
    """
    Automatically heals test scripts when they fail due to script issues.

    Healing workflow:
    1. Analyze failure to find the broken locator/code
    2. Search current UI for alternative elements
    3. Generate code fix
    4. Create Git branch with fix
    5. User reviews and merges (or auto-verify)
    """

    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        llm_client=None
    ):
        """
        Initialize the script healer.

        Args:
            config: Healing configuration.
            llm_client: Optional LLM client for intelligent suggestions.
        """
        self.config = config or {}
        self.llm_client = llm_client

        # Git configuration
        self.branch_prefix = self.config.get("branch_prefix", "autogenesis/heal/")
        self.auto_verify = self.config.get("auto_verify_on_merge", True)
        self.max_retries = self.config.get("max_retries", 3)
        self.confidence_threshold = self.config.get("confidence_threshold", 0.8)
        self.cleanup_on_success = self.config.get("cleanup_on_success", True)

    def heal(
        self,
        step_file: str,
        failed_step: str,
        error_message: str,
        classification: FailureClassification,
        current_ui_tree: str,
        recorded_ui_tree: Optional[str] = None
    ) -> HealingResult:
        """
        Attempt to heal a failed test step.

        Args:
            step_file: Path to the step definition file.
            failed_step: The BDD step that failed.
            error_message: Error message from failure.
            classification: Failure classification.
            current_ui_tree: Current page source.
            recorded_ui_tree: Original recorded page source.

        Returns:
            HealingResult with proposed fixes.
        """
        logger.info(f"Attempting to heal: {failed_step}")

        # Only heal SCRIPT_ISSUE type failures
        if classification.failure_type != FailureType.SCRIPT_ISSUE:
            return HealingResult(
                success=False,
                error=f"Cannot heal {classification.failure_type.value} type failures"
            )

        # Check confidence threshold
        if classification.confidence < self.confidence_threshold:
            return HealingResult(
                success=False,
                error=f"Confidence {classification.confidence:.2f} below threshold {self.confidence_threshold}"
            )

        try:
            # Step 1: Extract original locator from error/step
            original_locator = self._extract_locator(error_message, failed_step)
            if not original_locator:
                return HealingResult(
                    success=False,
                    error="Could not extract original locator from error message"
                )

            # Step 2: Find alternative locators
            alternatives = self.find_alternative_locators(
                original_locator, current_ui_tree, recorded_ui_tree
            )
            if not alternatives:
                return HealingResult(
                    success=False,
                    error="No alternative locators found in current UI"
                )

            # Step 3: Generate code fix
            fix = self._generate_code_fix(
                step_file, failed_step, original_locator, alternatives[0]
            )
            if not fix:
                return HealingResult(
                    success=False,
                    error="Could not generate code fix"
                )

            # Step 4: Create Git branch with fix
            branch_name = self._create_heal_branch(step_file, fix)

            return HealingResult(
                success=True,
                fixes=[fix],
                git_branch=branch_name,
                verification_status="pending"
            )

        except Exception as e:
            logger.error(f"Healing failed: {e}")
            return HealingResult(
                success=False,
                error=str(e)
            )

    def find_alternative_locators(
        self,
        original_locator: str,
        current_ui_tree: str,
        recorded_ui_tree: Optional[str] = None
    ) -> List[LocatorSuggestion]:
        """
        Find alternative locators in the current UI tree.

        Args:
            original_locator: The original (broken) locator.
            current_ui_tree: Current page source.
            recorded_ui_tree: Original page source.

        Returns:
            List of alternative locator suggestions, sorted by confidence.
        """
        logger.info(f"Finding alternatives for: {original_locator}")
        suggestions = []

        # Parse original locator
        strategy, value = self._parse_locator(original_locator)
        if not strategy or not value:
            return suggestions

        # Strategy 1: Find similar elements by attribute value
        similar_elements = self._find_similar_elements(
            value, current_ui_tree, strategy
        )
        for element in similar_elements:
            locators = self._generate_locators_for_element(element)
            for locator, loc_strategy, confidence in locators:
                suggestions.append(LocatorSuggestion(
                    locator=locator,
                    strategy=loc_strategy,
                    confidence=confidence,
                    element_info=element,
                    reason=f"Similar to original '{value}'"
                ))

        # Strategy 2: If we have recorded UI, find corresponding element by position/context
        if recorded_ui_tree:
            context_matches = self._find_by_context(
                original_locator, recorded_ui_tree, current_ui_tree
            )
            suggestions.extend(context_matches)

        # Strategy 3: Use LLM for intelligent matching
        if self.llm_client and len(suggestions) < 3:
            llm_suggestions = self._llm_find_alternatives(
                original_locator, current_ui_tree, recorded_ui_tree
            )
            suggestions.extend(llm_suggestions)

        # Sort by confidence and deduplicate
        suggestions = self._deduplicate_suggestions(suggestions)
        suggestions.sort(key=lambda x: x.confidence, reverse=True)

        return suggestions[:5]  # Return top 5

    def _extract_locator(
        self,
        error_message: str,
        failed_step: str
    ) -> Optional[str]:
        """
        Extract the locator that failed from error message or step.

        Args:
            error_message: Error message.
            failed_step: Failed step text.

        Returns:
            The extracted locator, or None.
        """
        # Common locator patterns
        patterns = [
            r'(?:accessibility_id|id|name|xpath|class_name):[\"\']?([^\"\'\s,\)]+)',
            r'locator[\"\':\s]+([^\"\'\s,\)]+)',
            r'element[\"\':\s]+([^\"\'\s,\)]+)',
            r'\"([^\"]+)\" not found',
            r"'([^']+)' not found",
        ]

        for text in [error_message, failed_step]:
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    return match.group(1)

        return None

    def _parse_locator(self, locator: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse a locator string into strategy and value.

        Args:
            locator: Locator string like "accessibility_id:login_button"

        Returns:
            Tuple of (strategy, value).
        """
        if ":" in locator:
            parts = locator.split(":", 1)
            return parts[0].strip(), parts[1].strip()

        # Default to assuming it's a name/label
        return "name", locator

    def _find_similar_elements(
        self,
        original_value: str,
        ui_tree: str,
        strategy: str
    ) -> List[Dict[str, Any]]:
        """
        Find elements with similar attributes in the UI tree.

        Args:
            original_value: Original element value to match.
            ui_tree: Current page source.
            strategy: Original locator strategy.

        Returns:
            List of similar elements with their attributes.
        """
        elements = []

        # Extract all elements with their attributes
        element_patterns = [
            # iOS/Mac patterns
            r'<(\w+)[^>]*name="([^"]*)"[^>]*(?:label="([^"]*)")?[^>]*(?:identifier="([^"]*)")?[^>]*>',
            # Android patterns
            r'<(\w+)[^>]*(?:text="([^"]*)")?[^>]*(?:resource-id="([^"]*)")?[^>]*(?:content-desc="([^"]*)")?[^>]*>',
        ]

        for pattern in element_patterns:
            matches = re.findall(pattern, ui_tree, re.IGNORECASE)
            for match in matches:
                element_type = match[0]
                attrs = [attr for attr in match[1:] if attr]

                # Check similarity to original value
                for attr in attrs:
                    similarity = self._calculate_similarity(original_value, attr)
                    if similarity > 0.5:  # At least 50% similar
                        elements.append({
                            "type": element_type,
                            "name": match[1] if len(match) > 1 else "",
                            "label": match[2] if len(match) > 2 else "",
                            "identifier": match[3] if len(match) > 3 else "",
                            "similarity": similarity,
                            "matched_attr": attr
                        })

        # Sort by similarity
        elements.sort(key=lambda x: x.get("similarity", 0), reverse=True)
        return elements[:10]  # Return top 10

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """
        Calculate string similarity ratio.

        Args:
            str1: First string.
            str2: Second string.

        Returns:
            Similarity ratio (0.0 - 1.0).
        """
        if not str1 or not str2:
            return 0.0

        # Use difflib for sequence matching
        return difflib.SequenceMatcher(
            None, str1.lower(), str2.lower()
        ).ratio()

    def _generate_locators_for_element(
        self,
        element: Dict[str, Any]
    ) -> List[Tuple[str, str, float]]:
        """
        Generate possible locators for an element.

        Args:
            element: Element info dictionary.

        Returns:
            List of (locator_string, strategy, confidence) tuples.
        """
        locators = []
        base_confidence = element.get("similarity", 0.5)

        # Accessibility ID / identifier is most stable
        if element.get("identifier"):
            locators.append((
                f"accessibility_id:{element['identifier']}",
                "accessibility_id",
                min(base_confidence + 0.2, 1.0)
            ))

        # Name is usually reliable
        if element.get("name"):
            locators.append((
                f"name:{element['name']}",
                "name",
                base_confidence
            ))

        # Label/text
        if element.get("label"):
            locators.append((
                f"label:{element['label']}",
                "label",
                base_confidence - 0.1
            ))

        return locators

    def _find_by_context(
        self,
        original_locator: str,
        recorded_ui: str,
        current_ui: str
    ) -> List[LocatorSuggestion]:
        """
        Find element by comparing context between recorded and current UI.

        Args:
            original_locator: Original locator.
            recorded_ui: Recorded UI tree.
            current_ui: Current UI tree.

        Returns:
            List of suggestions based on context matching.
        """
        # This is a simplified implementation
        # A full implementation would parse XML and compare element positions/siblings
        return []

    def _llm_find_alternatives(
        self,
        original_locator: str,
        current_ui: str,
        recorded_ui: Optional[str]
    ) -> List[LocatorSuggestion]:
        """
        Use LLM to find alternative locators.

        Args:
            original_locator: Original locator.
            current_ui: Current page source.
            recorded_ui: Recorded page source.

        Returns:
            LLM-suggested alternatives.
        """
        if not self.llm_client:
            return []

        # LLM integration placeholder
        logger.info("LLM locator finding not implemented yet")
        return []

    def _deduplicate_suggestions(
        self,
        suggestions: List[LocatorSuggestion]
    ) -> List[LocatorSuggestion]:
        """
        Remove duplicate suggestions.

        Args:
            suggestions: List of suggestions.

        Returns:
            Deduplicated list.
        """
        seen = set()
        unique = []
        for s in suggestions:
            if s.locator not in seen:
                seen.add(s.locator)
                unique.append(s)
        return unique

    def _generate_code_fix(
        self,
        step_file: str,
        failed_step: str,
        original_locator: str,
        new_locator: LocatorSuggestion
    ) -> Optional[CodeFix]:
        """
        Generate a code fix for the step file.

        Args:
            step_file: Path to step definition file.
            failed_step: The failed step text.
            original_locator: Original locator string.
            new_locator: New locator suggestion.

        Returns:
            CodeFix with the proposed change.
        """
        try:
            with open(step_file, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')

            # Find the line with the original locator
            line_number = None
            original_line = None
            for i, line in enumerate(lines):
                if original_locator in line or self._normalize_locator(original_locator) in line:
                    line_number = i + 1  # 1-indexed
                    original_line = line
                    break

            if line_number is None:
                # Try fuzzy matching
                _, original_value = self._parse_locator(original_locator)
                for i, line in enumerate(lines):
                    if original_value and original_value in line:
                        line_number = i + 1
                        original_line = line
                        break

            if line_number is None:
                logger.warning(f"Could not find locator '{original_locator}' in {step_file}")
                return None

            # Generate fixed line
            fixed_line = original_line.replace(
                original_locator,
                new_locator.locator
            )

            # If exact replacement didn't work, try value-only replacement
            if fixed_line == original_line:
                _, original_value = self._parse_locator(original_locator)
                _, new_value = self._parse_locator(new_locator.locator)
                if original_value and new_value:
                    fixed_line = original_line.replace(original_value, new_value)

            return CodeFix(
                file_path=step_file,
                line_number=line_number,
                original_code=original_line,
                fixed_code=fixed_line,
                fix_type="locator_update",
                confidence=new_locator.confidence,
                description=f"Update locator from '{original_locator}' to '{new_locator.locator}'"
            )

        except Exception as e:
            logger.error(f"Error generating code fix: {e}")
            return None

    def _normalize_locator(self, locator: str) -> str:
        """Normalize a locator string for comparison."""
        # Remove quotes and extra spaces
        return re.sub(r'[\"\'\s]', '', locator.lower())

    def _create_heal_branch(
        self,
        step_file: str,
        fix: CodeFix
    ) -> Optional[str]:
        """
        Create a Git branch with the healing fix.

        Args:
            step_file: Path to the step file.
            fix: The code fix to apply.

        Returns:
            Name of the created branch, or None.
        """
        try:
            # Generate branch name
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            element_name = re.sub(r'[^a-zA-Z0-9]', '_', fix.description[:30])
            branch_name = f"{self.branch_prefix}{element_name}_{timestamp}"

            # Get repo root
            repo_root = self._get_git_root(step_file)
            if not repo_root:
                logger.warning("Not a Git repository, skipping branch creation")
                return None

            # Create branch
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=repo_root,
                check=True,
                capture_output=True
            )

            # Apply fix
            self.apply_fix(fix)

            # Stage and commit
            subprocess.run(
                ["git", "add", step_file],
                cwd=repo_root,
                check=True,
                capture_output=True
            )

            commit_message = f"""fix(heal): {fix.description}

- Old: {fix.original_code.strip()}
- New: {fix.fixed_code.strip()}

Confidence: {fix.confidence:.0%}
Auto-healed by AutoGenesis
"""
            subprocess.run(
                ["git", "commit", "-m", commit_message],
                cwd=repo_root,
                check=True,
                capture_output=True
            )

            logger.info(f"Created healing branch: {branch_name}")
            return branch_name

        except subprocess.CalledProcessError as e:
            logger.error(f"Git operation failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating heal branch: {e}")
            return None

    def _get_git_root(self, file_path: str) -> Optional[str]:
        """
        Get the Git repository root for a file.

        Args:
            file_path: Path to a file.

        Returns:
            Repository root path, or None.
        """
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                cwd=os.path.dirname(file_path),
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return None

    def apply_fix(
        self,
        fix: CodeFix,
        backup: bool = True
    ) -> bool:
        """
        Apply a code fix to the file.

        Args:
            fix: The fix to apply.
            backup: Whether to create a backup.

        Returns:
            True if successful.
        """
        try:
            file_path = Path(fix.file_path)

            # Create backup if requested
            if backup:
                backup_path = file_path.with_suffix(f".py.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
                backup_path.write_text(file_path.read_text(encoding='utf-8'), encoding='utf-8')

            # Read and modify
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')

            if fix.line_number <= len(lines):
                lines[fix.line_number - 1] = fix.fixed_code
                file_path.write_text('\n'.join(lines), encoding='utf-8')
                logger.info(f"Applied fix to {fix.file_path}:{fix.line_number}")
                return True
            else:
                logger.error(f"Line number {fix.line_number} out of range")
                return False

        except Exception as e:
            logger.error(f"Error applying fix: {e}")
            return False

    def verify_fix(
        self,
        branch_name: str,
        feature_file: str,
        scenario_name: str
    ) -> bool:
        """
        Verify that a fix works by running the test.

        Args:
            branch_name: Name of the heal branch.
            feature_file: Feature file to test.
            scenario_name: Scenario to run.

        Returns:
            True if test passes after fix.
        """
        try:
            repo_root = self._get_git_root(feature_file)
            if not repo_root:
                return False

            # Run behave with the specific scenario
            result = subprocess.run(
                ["behave", feature_file, "--name", scenario_name, "--no-capture"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            return result.returncode == 0

        except subprocess.TimeoutExpired:
            logger.warning("Test verification timed out")
            return False
        except Exception as e:
            logger.error(f"Error verifying fix: {e}")
            return False

    def cleanup_branch(self, branch_name: str, repo_path: str) -> bool:
        """
        Clean up a healing branch after successful merge.

        Args:
            branch_name: Name of the branch to delete.
            repo_path: Path to the repository.

        Returns:
            True if cleanup successful.
        """
        try:
            subprocess.run(
                ["git", "branch", "-D", branch_name],
                cwd=repo_path,
                check=True,
                capture_output=True
            )
            logger.info(f"Cleaned up branch: {branch_name}")
            return True
        except subprocess.CalledProcessError as e:
            logger.warning(f"Could not delete branch {branch_name}: {e}")
            return False
