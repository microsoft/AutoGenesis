# -*- coding: utf-8 -*-
"""
Behave environment configuration for Mobile testing examples.
"""

import os
import sys
import json
from pathlib import Path

# Add AutoGenesis to path
autogenesis_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(autogenesis_root))


def before_all(context):
    """Initialize mobile testing environment."""
    # Load configuration
    config_path = Path(__file__).parent.parent / "config" / "mobile_config.json"
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            context.config = json.load(f)
    else:
        context.config = {}

    # Determine platform
    context.platform = os.environ.get(
        "AUTOGENESIS_PLATFORM",
        context.config.get("platform", "ios")
    )

    print(f"Mobile Testing Platform: {context.platform}")
    print(f"Config loaded from: {config_path}")


def before_feature(context, feature):
    """Setup before each feature."""
    context.feature_name = feature.name
    print(f"\n{'='*60}")
    print(f"Feature: {feature.name}")
    print(f"{'='*60}")


def before_scenario(context, scenario):
    """Setup before each scenario."""
    context.scenario_name = scenario.name
    print(f"\n  Scenario: {scenario.name}")
    print(f"  {'-'*50}")


def after_scenario(context, scenario):
    """Cleanup after each scenario."""
    status = "PASSED" if scenario.status == "passed" else "FAILED"
    print(f"  Result: {status}")


def after_all(context):
    """Cleanup after all tests."""
    print("\n" + "="*60)
    print("Mobile testing completed")
    print("="*60)
