#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AutoGenesis CLI - Command line interface for AI-powered testing.

Usage:
    autogenesis server [--platform PLATFORM...] [--transport TYPE] [--config PATH]
    autogenesis run <feature> [--scenario NAME] [--platform PLATFORM]
    autogenesis heal <step_file> [--branch PREFIX]
    autogenesis analyze <result_file>
    autogenesis init [--platform PLATFORM]
    autogenesis --version
    autogenesis --help

Commands:
    server      Start the MCP server
    run         Run BDD tests
    heal        Analyze and heal failed tests
    analyze     Analyze test results
    init        Initialize a new test project
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import List, Optional

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def setup_logging(verbose: bool = False) -> None:
    """Configure logging for CLI."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )


def cmd_server(args: argparse.Namespace) -> int:
    """Start the MCP server."""
    from servers.unified_mcp_server import run_server

    platforms = args.platform if args.platform else ["all"]
    transport = args.transport or "stdio"
    config_path = args.config

    print(f"Starting AutoGenesis MCP server...")
    print(f"  Platforms: {', '.join(platforms)}")
    print(f"  Transport: {transport}")
    if config_path:
        print(f"  Config: {config_path}")

    try:
        asyncio.run(run_server(transport, config_path, platforms))
        return 0
    except KeyboardInterrupt:
        print("\nServer stopped.")
        return 0
    except Exception as e:
        print(f"Error starting server: {e}")
        return 1


def cmd_run(args: argparse.Namespace) -> int:
    """Run BDD tests using Behave."""
    import subprocess

    feature_path = args.feature
    scenario = args.scenario
    platform = args.platform

    if not Path(feature_path).exists():
        print(f"Error: Feature file not found: {feature_path}")
        return 1

    # Build behave command
    cmd = ["behave", feature_path]

    if scenario:
        cmd.extend(["--name", scenario])

    # Set platform environment variable
    if platform:
        os.environ["AUTOGENESIS_PLATFORM"] = platform

    print(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, cwd=os.getcwd())
        return result.returncode
    except FileNotFoundError:
        print("Error: 'behave' not found. Install with: pip install behave")
        return 1


def cmd_heal(args: argparse.Namespace) -> int:
    """Analyze and heal failed tests."""
    from core.analysis import FailureClassifier, ScriptHealer, FailureType

    step_file = args.step_file
    branch_prefix = args.branch or "autogenesis/heal/"

    if not Path(step_file).exists():
        print(f"Error: Step file not found: {step_file}")
        return 1

    print(f"Analyzing step file: {step_file}")
    print(f"Branch prefix: {branch_prefix}")

    # Load configuration
    healer_config = {
        "branch_prefix": branch_prefix,
        "auto_verify_on_merge": True,
        "max_retries": 3,
        "confidence_threshold": 0.8,
    }

    healer = ScriptHealer(config=healer_config)
    classifier = FailureClassifier()

    # Interactive healing mode
    print("\nEnter failure details for healing:")
    print("-" * 40)

    try:
        error_message = input("Error message: ").strip()
        failed_step = input("Failed step: ").strip()

        # Get current UI (optional)
        ui_file = input("Current UI tree file (optional, press Enter to skip): ").strip()
        current_ui = ""
        if ui_file and Path(ui_file).exists():
            current_ui = Path(ui_file).read_text(encoding='utf-8')

        # Classify the failure
        print("\nClassifying failure...")
        classification = classifier.classify(
            error_message=error_message,
            failed_step=failed_step,
            current_ui_tree=current_ui if current_ui else None
        )

        print(f"\nClassification: {classification.failure_type.value}")
        print(f"Confidence: {classification.confidence:.0%}")
        print(f"Reason: {classification.reason}")

        if classification.failure_type != FailureType.SCRIPT_ISSUE:
            print(f"\nThis failure type ({classification.failure_type.value}) cannot be auto-healed.")
            print("Suggestions:")
            for suggestion in classification.suggestions:
                print(f"  - {suggestion}")
            return 0

        # Attempt healing
        print("\nAttempting to heal...")
        result = healer.heal(
            step_file=step_file,
            failed_step=failed_step,
            error_message=error_message,
            classification=classification,
            current_ui_tree=current_ui
        )

        if result.success:
            print(f"\nHealing successful!")
            print(f"Git branch created: {result.git_branch}")
            print("\nTo apply the fix:")
            print(f"  git checkout main && git merge {result.git_branch}")
        else:
            print(f"\nHealing failed: {result.error}")

        return 0 if result.success else 1

    except KeyboardInterrupt:
        print("\nCancelled.")
        return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    """Analyze test results."""
    from core.analysis import ResultAnalyzer

    result_file = args.result_file

    if not Path(result_file).exists():
        print(f"Error: Result file not found: {result_file}")
        return 1

    print(f"Analyzing: {result_file}")

    analyzer = ResultAnalyzer()

    try:
        # Load and analyze results
        if result_file.endswith('.json'):
            with open(result_file, 'r', encoding='utf-8') as f:
                results = json.load(f)
            report = analyzer.analyze_json_report(results)
        else:
            print("Error: Only JSON result files are supported currently.")
            return 1

        # Print report
        print("\n" + "=" * 60)
        print("TEST ANALYSIS REPORT")
        print("=" * 60)
        print(f"\nTotal Scenarios: {report.total_scenarios}")
        print(f"Passed: {report.passed_scenarios}")
        print(f"Failed: {report.failed_scenarios}")
        print(f"Pass Rate: {report.pass_rate:.1%}")

        if report.failures:
            print("\n" + "-" * 40)
            print("FAILURE ANALYSIS")
            print("-" * 40)
            for failure in report.failures:
                print(f"\nScenario: {failure.scenario_name}")
                print(f"  Step: {failure.failed_step}")
                print(f"  Type: {failure.classification.failure_type.value}")
                print(f"  Healable: {'Yes' if failure.classification.healable else 'No'}")

        return 0

    except Exception as e:
        print(f"Error analyzing results: {e}")
        return 1


def cmd_init(args: argparse.Namespace) -> int:
    """Initialize a new test project."""
    platform = args.platform or "mobile"

    print(f"Initializing AutoGenesis test project for platform: {platform}")

    # Create directory structure
    dirs = [
        "features",
        "features/steps",
        "features/support",
        "config",
        "reports",
    ]

    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)
        print(f"  Created: {d}/")

    # Create sample feature file
    sample_feature = """# language: en
Feature: Sample Login Test
  As a user
  I want to log into the application
  So that I can access my account

  Scenario: Successful login
    Given the app is launched
    When I tap the "Login" button
    And I enter "test@example.com" in the username field
    And I enter "password123" in the password field
    And I tap the "Submit" button
    Then I should see the home screen
"""

    feature_file = Path("features/sample_login.feature")
    if not feature_file.exists():
        feature_file.write_text(sample_feature, encoding='utf-8')
        print(f"  Created: {feature_file}")

    # Create environment.py
    env_content = f'''# -*- coding: utf-8 -*-
"""
Behave environment configuration for AutoGenesis.
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def before_all(context):
    """Initialize before all tests."""
    context.platform = os.environ.get("AUTOGENESIS_PLATFORM", "{platform}")
    print(f"Testing platform: {{context.platform}}")


def after_all(context):
    """Cleanup after all tests."""
    pass


def before_scenario(context, scenario):
    """Setup before each scenario."""
    context.scenario_name = scenario.name


def after_scenario(context, scenario):
    """Cleanup after each scenario."""
    pass
'''

    env_file = Path("features/environment.py")
    if not env_file.exists():
        env_file.write_text(env_content, encoding='utf-8')
        print(f"  Created: {env_file}")

    # Create sample config
    config_template = {
        "mobile": {
            "ios": {
                "platformName": "iOS",
                "deviceName": "iPhone 16 Pro",
                "platformVersion": "18.0",
                "automationName": "XCUITest",
                "server_url": "http://127.0.0.1:4723",
                "appium:app": "/path/to/your/app.ipa"
            }
        },
        "healing": {
            "enabled": True,
            "mode": "git_branch",
            "confidence_threshold": 0.8
        }
    }

    config_file = Path("config/autogenesis.json")
    if not config_file.exists():
        config_file.write_text(
            json.dumps(config_template, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )
        print(f"  Created: {config_file}")

    # Create steps __init__.py
    init_file = Path("features/steps/__init__.py")
    if not init_file.exists():
        init_file.write_text("# Step definitions\n", encoding='utf-8')
        print(f"  Created: {init_file}")

    print("\nProject initialized successfully!")
    print("\nNext steps:")
    print("  1. Edit config/autogenesis.json with your settings")
    print("  2. Write your feature files in features/")
    print("  3. Run: autogenesis server --platform mobile")
    print("  4. Use Claude Code to execute and generate step definitions")

    return 0


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog='autogenesis',
        description='AutoGenesis - AI-powered automated testing framework',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  autogenesis server --platform mobile --transport stdio
  autogenesis run features/login.feature --scenario "Successful login"
  autogenesis heal features/steps/login_steps.py
  autogenesis init --platform ios
        '''
    )

    parser.add_argument(
        '--version',
        action='version',
        version='AutoGenesis 1.0.0'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Server command
    server_parser = subparsers.add_parser('server', help='Start the MCP server')
    server_parser.add_argument(
        '--platform',
        action='append',
        choices=['all', 'mobile', 'ios', 'android', 'windows', 'mac'],
        help='Platform(s) to enable (can specify multiple)'
    )
    server_parser.add_argument(
        '--transport',
        choices=['stdio', 'sse'],
        default='stdio',
        help='Transport type (default: stdio)'
    )
    server_parser.add_argument(
        '--config',
        type=str,
        help='Path to configuration file'
    )

    # Run command
    run_parser = subparsers.add_parser('run', help='Run BDD tests')
    run_parser.add_argument(
        'feature',
        help='Feature file or directory to run'
    )
    run_parser.add_argument(
        '--scenario',
        '-s',
        help='Specific scenario name to run'
    )
    run_parser.add_argument(
        '--platform',
        '-p',
        help='Target platform'
    )

    # Heal command
    heal_parser = subparsers.add_parser('heal', help='Analyze and heal failed tests')
    heal_parser.add_argument(
        'step_file',
        help='Step definition file to heal'
    )
    heal_parser.add_argument(
        '--branch',
        '-b',
        help='Git branch prefix for healing (default: autogenesis/heal/)'
    )

    # Analyze command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze test results')
    analyze_parser.add_argument(
        'result_file',
        help='Test result file to analyze (JSON format)'
    )

    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize a new test project')
    init_parser.add_argument(
        '--platform',
        '-p',
        choices=['mobile', 'ios', 'android', 'windows', 'mac'],
        default='mobile',
        help='Primary testing platform (default: mobile)'
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose if hasattr(args, 'verbose') else False)

    # Execute command
    if args.command == 'server':
        return cmd_server(args)
    elif args.command == 'run':
        return cmd_run(args)
    elif args.command == 'heal':
        return cmd_heal(args)
    elif args.command == 'analyze':
        return cmd_analyze(args)
    elif args.command == 'init':
        return cmd_init(args)
    else:
        parser.print_help()
        return 0


if __name__ == '__main__':
    sys.exit(main())
