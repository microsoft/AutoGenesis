# Contributing to AutoGenesis

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## How to Contribute

### Reporting Issues

If you find a bug or have a feature request, please create an issue in the GitHub repository. When reporting issues, please include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Environment details (OS, Python version, etc.)

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Test your changes thoroughly
5. Commit your changes with clear commit messages
6. Push to your fork
7. Submit a pull request to the main repository

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/microsoft/AutoGenesis.git
   cd AutoGenesis
   ```
2. Install dependencies:
   ```bash
   cd appium-mcp-server
   pip install -r requirements.txt
   ```
3. Configure the Appium settings in `appium-mcp-server/conf/appium_conf.json`

### Code Style

- Follow PEP 8 style guidelines for Python code
- Use meaningful variable and function names
- Add comments for complex logic
- Write docstrings for functions and classes

### Testing

Before submitting a pull request, please ensure:

- Your code passes all existing tests
- You've added tests for new functionality
- The code works with the supported Python versions

### Commit Messages

- Use clear and meaningful commit messages
- Start with a verb in present tense (e.g., "Add", "Fix", "Update")
- Keep the first line under 50 characters
- Provide detailed description in the body if needed

## Questions?

If you have questions about contributing, feel free to open an issue or reach out to the maintainers.

Thank you for contributing to AutoGenesis!
