# Contributing to AutoGenesis

Thank you for your interest in contributing to AutoGenesis! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Contributions](#making-contributions)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## Getting Started

### Prerequisites

- Python 3.9 or higher
- Git
- Virtual environment tool (venv, conda, etc.)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/AutoGenesis.git
   cd AutoGenesis
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/anthropics/autogenesis.git
   ```

## Development Setup

### Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install pytest pytest-asyncio black flake8 mypy
```

### Platform-Specific Setup

#### Mobile Testing (iOS/Android)
```bash
# Install Appium
npm install -g appium
appium driver install xcuitest
appium driver install uiautomator2
```

#### Mac Testing
```bash
appium driver install mac2
# Enable Accessibility in System Settings
```

#### Windows Testing
```bash
# pywinauto is included in requirements.txt
# No additional setup needed
```

### Verify Installation

```bash
# Run the unified server
python servers/unified_mcp_server.py --transport stdio --platform all

# Or use the CLI
python -m cli.main --help
```

## Project Structure

```
AutoGenesis/
├── core/                   # Core shared functionality
│   ├── agent/             # Agent coordinator and skill loader
│   ├── llm/               # LLM integration
│   ├── utils/             # Utilities
│   ├── bdd/               # BDD code generation
│   └── analysis/          # Failure analysis & healing
│
├── skills/                # Platform skills
│   ├── base_skill.py      # Abstract base class
│   ├── mobile_skill/      # iOS/Android
│   ├── desktop_windows_skill/  # Windows
│   └── desktop_mac_skill/ # Mac
│
├── servers/               # MCP servers
│   └── unified_mcp_server.py
│
├── cli/                   # Command line interface
│   └── main.py
│
├── ide_integrations/      # IDE support
├── examples/              # Example tests
├── docs/                  # Documentation
└── tests/                 # Test suite
```

## Making Contributions

### Types of Contributions

1. **Bug Fixes**: Fix issues in existing code
2. **Features**: Add new capabilities
3. **Documentation**: Improve or add documentation
4. **Tests**: Add or improve tests
5. **Skills**: Add support for new platforms

### Creating a New Skill

To add a new testing skill:

1. Create a new directory under `skills/`:
   ```
   skills/new_skill/
   ├── __init__.py          # Skill class
   ├── session_manager.py   # Session management
   ├── skill_manifest.json  # Skill metadata
   └── tools/
       └── __init__.py      # Tool implementations
   ```

2. Implement the skill class extending `BaseSkill`:
   ```python
   from skills.base_skill import BaseSkill, SkillManifest, ToolResponse

   class NewSkill(BaseSkill):
       def _load_manifest(self) -> SkillManifest:
           ...

       async def initialize(self) -> bool:
           ...

       async def execute(self, task: str, context: ExecutionContext) -> ToolResponse:
           ...

       def get_available_tools(self) -> List[str]:
           ...

       def register_tools(self, mcp_server, session_manager) -> None:
           ...

       async def cleanup(self) -> None:
           ...
   ```

3. Register the skill in `core/agent/skill_loader.py`

4. Add tools registration in `servers/unified_mcp_server.py`

## Coding Standards

### Python Style

- Follow PEP 8 style guide
- Use type hints for function parameters and returns
- Maximum line length: 100 characters
- Use docstrings for all public functions and classes

### Code Formatting

```bash
# Format code
black .

# Check linting
flake8 .

# Type checking
mypy core/ skills/ servers/
```

### Naming Conventions

- Classes: `PascalCase`
- Functions/methods: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leading_underscore`

### Documentation

- All public APIs must have docstrings
- Use Google-style docstrings:
  ```python
  def function(param1: str, param2: int) -> bool:
      """Short description.

      Longer description if needed.

      Args:
          param1: Description of param1.
          param2: Description of param2.

      Returns:
          Description of return value.

      Raises:
          ValueError: When something is wrong.
      """
  ```

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_skill_loader.py

# Run with coverage
pytest --cov=core --cov=skills
```

### Writing Tests

- Place tests in the `tests/` directory
- Mirror the source structure: `core/agent/` → `tests/core/test_agent.py`
- Use descriptive test names: `test_skill_loader_loads_mobile_skill`
- Use fixtures for common setup

Example test:
```python
import pytest
from core.agent.skill_loader import SkillLoader

@pytest.fixture
def skill_loader():
    return SkillLoader()

@pytest.mark.asyncio
async def test_load_mobile_skill(skill_loader):
    skill = await skill_loader.load_skill("mobile_skill")
    assert skill is not None
    assert skill.name == "Mobile Skill"
```

## Submitting Changes

### Branch Naming

- Features: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`

### Commit Messages

Follow conventional commits format:
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(mobile): add swipe gesture support
fix(healer): handle missing UI tree gracefully
docs(readme): update installation instructions
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add or update tests
4. Update documentation if needed
5. Run linting and tests
6. Push to your fork
7. Create a Pull Request

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Linting passes
- [ ] All tests pass
```

## Reporting Issues

If you find a bug or have a feature request, please create an issue in the GitHub repository. When reporting issues, please include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Environment details (OS, Python version, etc.)

## Questions?

- Open an issue for questions
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones

Thank you for contributing to AutoGenesis!
