<!--=========================README TEMPLATE INSTRUCTIONS=============================
======================================================================================

- THIS README TEMPLATE LARGELY CONSISTS OF COMMENTED OUT TEXT. THIS UNRENDERED TEXT IS MEANT TO BE LEFT IN AS A GUIDE 
  THROUGHOUT THE REPOSITORY'S LIFE WHILE END USERS ONLY SEE THE RENDERED PAGE CONTENT. 
- Any italicized text rendered in the initial template is intended to be replaced IMMEDIATELY upon repository creation.

- This template is default but not mandatory. It was designed to compensate for typical gaps in Microsoft READMEs 
  that slow the pace of work. You may delete it if you have a fully populated README to replace it with.

- Most README sections below are commented out as they are not known early in a repository's life. Others are commented 
  out as they do not apply to every repository. If a section will be appropriate later but not known now, consider 
  leaving it in commented out and adding an issue as a reminder.
- There are additional optional README sections in the external instruction link below. These include; "citation",  
  "built with", "acknowledgments", "folder structure", etc.
- You can easily find the places to add content that will be rendered to the end user by searching 
within the file for "TODO".



- ADDITIONAL EXTERNAL TEMPLATE INSTRUCTIONS:
  -  https://aka.ms/StartRight/README-Template/Instructions

======================================================================================
====================================================================================-->


<!---------------------[  Description  ]------------------<recommended> section below------------------>

# AutoGenesis

<!-- 
INSTRUCTIONS:
- Write description paragraph(s) that can stand alone. Remember 1st paragraph may be consumed by aggregators to improve 
  search experience.
- You description should allow any reader to figure out:
    1. What it does?
    2. Why was it was created?
    3. Who created?
    4. What is it's maturity?
    5. What is the larger context?
- Write for a reasonable person with zero context regarding your product, org, and team. The person may be evaluating if 
this is something they can use.

How to Evaluate & Examples: 
  - https://aka.ms/StartRight/README-Template/Instructions#description
-->

AutoGenesis is a cross-platform client automation solution that leverages AI to automatically generate test code, significantly reducing manual effort. It supports Windows, macOS, iOS, and Android.

This project combines BDD (Behavior-Driven Development) testing with AI assistance powered by GitHub Copilot to streamline the test automation process. It includes:
- **appium-mcp-server**: MCP (Model Context Protocol) server for mobile and desktop automation
- **pywinauto-mcp-server**: MCP server for Windows desktop application automation using pywinauto
- **bdd_ai_toolkit**: VS Code extension for AI-powered test recording
- **behave-demo**: Sample BDD test cases using Behave framework

## Features

- 🤖 AI-powered test script generation using GitHub Copilot
- 📝 Natural language test case writing
- 🔄 Automatic step definition generation
- 🎯 BDD test case validation and best practices
- 📱 Multi-platform support (Windows, macOS, iOS, Android)

-----------------------------------------------------------------
<!-----------------------[  License  ]----------------------<optional> section below--------------------->

<!-- 
## License 
--> 

<!-- 
INSTRUCTIONS:
- Licensing is mostly irrelevant within the company for purely internal code. Use this section to prevent potential 
  confusion around:
  - Open source in internal code repository.
  - Multiple licensed code in same repository. 
  - Internal fork of public open source code.

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#license
-->

<!---- [TODO]  CONTENT GOES BELOW ------->

<!------====-- CONTENT GOES ABOVE ------->



<!-----------------------[  Getting Started  ]--------------<recommended> section below------------------>
## Getting Started

<!-- 
INSTRUCTIONS:
  - Write instructions such that any new user can get the project up & running on their machine.
  - This section has subsections described further down of "Prerequisites", "Installing", and "Deployment". 

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#getting-started
-->

### Clone the Repository

Open PowerShell and run:

    git clone https://github.com/ai-microsoft/AutoGenesis.git
    cd AutoGenesis

### Setup MCP Server

1. Click "Setup MCP Server" in the BDD AI Toolkit panel
2. Wait for the setup to complete (~1 minute)
3. Click "Start" to start the server
4. Verify the server status shows "Running" and MCP tools are listed

### Enable Auto-Approve (Optional)

For a smoother experience, enable auto-approve for MCP tools by pasting this link in your browser:

    vscode://settings/chat.tools.autoApprove


<!-----------------------[ Prerequisites  ]-----------------<optional> section below--------------------->
### Prerequisites

<!--------------------------------------------------------
INSTRUCTIONS:
- Describe what things a new user needs to install in order to install and use the repository. 

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#prerequisites
---------------------------------------------------------->

- Visual Studio Code
- GitHub Copilot subscription
- Python 3.10 or higher
- Node.js and npm
- Microsoft Edge (Stable, Beta, or Canary)


<!-----------------------[  Installing  ]-------------------<optional> section below------------------>
### Installing

<!--
INSTRUCTIONS:
- A step by step series of examples that tell you how to get a development environment and your code running. 
- Best practice is to include examples that can be copy and pasted directly from the README into a terminal.

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#installing
-->

#### 1. Install Required Tools

**Visual Studio Code**
- Download: https://code.visualstudio.com/

**GitHub Copilot**
- Install the GitHub Copilot extension from VS Code Extensions Marketplace
- Sign in with your GitHub account
- Guide: https://docs.github.com/en/copilot

#### 2. Install VS Code Extensions

Required extensions:
- **BDD AI Toolkit** - For recording automation test scripts
- **Cucumber (Gherkin) Full Support** - For BDD syntax highlighting

Steps:
1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions view
3. Search and install both extensions

#### 3. Setup Environment

1. Click the BDD AI Toolkit button in the left panel
2. Check your environment status
3. Install NPM and Python (>3.10) manually if needed
4. Click "Auto-resolve" to install VS Code CLI and UV tool automatically

#### 4. Install Microsoft Edge

Download: https://microsoft.com/en-us/edge/download/insider?form=MA13FJ


<!-----------------------[  Tests  ]------------------------<optional> section below--------------------->

## Usage

### Writing Tests with Natural Language

1. **Select Agent Mode** in GitHub Copilot Chat
2. **Choose Claude Sonnet 4** as your model
3. **Send a natural language task** using `#sendNaturalLanguageTask <your task>`

Example:

    #sendNaturalLanguageTask Test msn.com website on Edge browser

### Recording Test Scripts

Use the following prompt template in Copilot Chat:

    Please use win-auto-mcp to execute the following instructions:

    # Original BDD Test Case (strictly follow step-by-step):
    Scenario: Download PDF file
    Given Edge is launched
        When I navigate to "https://getsamplefiles.com/download/pdf/sample-1.pdf"
        Then the Downloads pane should appear
        When I navigate to "edge://downloads"
        Then "sample-1.pdf" should appear in download list
        
    Requirements:
    feature_file = c:\Users\yuexiong\projects\AutoGenesis\behave-demo\features\demo.feature
    1. Before executing the first step, call `before_gen_code`, and after all steps are completed, sequentially call `preview_code_changes` and `confirm_code_change`.
    2. Execute **each step** exactly as written, in order. Do not lose bdd step keyword.
    3. **Do not modify, merge, skip, or add any step.**
    4. Use **only** win-auto-mcp API calls.
    5. Do not close browser

### Running Tests

**Option 1: Run from Copilot Extension**
- Use the run button in the BDD AI Toolkit panel

**Option 2: Run via Command Line**

    cd behave-demo
    uv run behave --name "Test msn.com website on Edge"

## Writing Good BDD Test Cases

### ✅ Good Example

    Scenario: Sort favorites alphabetically Z to A
      Given I have favorites "Microsoft", "Bing", and "GitHub" in my Favorites bar
      When I click the Favorites icon in the toolbar
      And I click the "Sort favorites" button
      And I select "Z to A" from the sort options menu
      Then the favorites should be sorted as "Microsoft", "GitHub", "Bing"
      And the "Z to A" option should be checked in the sort options menu

**Why this is good:**
- Concrete, specific actions with explicit content
- Focuses on one functionality
- Concise Given statement
- Verifies functional results
- Uses explicit names

### ❌ Bad Example

    Scenario: Sort favorites using different methods
      Given the Favorites flyout is open
      When the user clicks the "Sort favorites" button
      And the user selects "Frequently visited" in the options menu
      Then the sort button icon should change
      # ... multiple similar steps

**Why this is bad:**
- Multiple functionalities in one scenario
- Uses third-person perspective
- Focuses on UI changes instead of functional behavior
- No verification of actual sorting
- Repetitive patterns

## Project Structure

    AutoGenesis/
    ├── appium-mcp-server/       # MCP server for mobile/mac automation
    │   ├── tools/               # Platform-specific driver tools
    │   ├── llm/                 # LLM integration
    │   └── utils/               # Utilities
    ├── pywinauto-mcp-server/    # MCP server for Windows automation
    │   ├── tools/               # Windows-specific automation tools
    │   ├── llm/                 # LLM integration
    │   └── utils/               # Utilities
    ├── bdd_ai_toolkit/          # VS Code extension
    │   ├── src/                 # Extension source code
    │   └── resources/           # UI resources
    └── behave-demo/             # Sample BDD tests
        └── features/            # Feature files and step definitions

## Configuration

### Appium Configuration

Edit `appium-mcp-server/conf/appium_conf.json` to configure Appium settings.

### Pywinauto Configuration

Edit `pywinauto-mcp-server/conf/app_conf.json` to configure Windows application automation settings.

### Azure GPT (Optional)

Configure Azure GPT deployment in the MCP server settings to enable screenshot analysis.

## Troubleshooting

- Ensure Python version is 3.10 or higher
- Verify MCP server status is "Running"
- Check that all required VS Code extensions are installed
- Enable auto-approve for smoother MCP tool execution

## Feedback

For questions or feedback, please contact: fsqgroup@microsoft.com

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

See [LICENSE](LICENSE) for license information.

<!--
INSTRUCTIONS:
- Explain how to run the tests for this project. You may want to link here from Deployment (CI/CD) or Contributing sections.

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#tests
-->

<!---- [TODO]  CONTENT GOES BELOW ------->
<!--

*Explain what these tests test and why* 

```
Give an example
``` 

-->
<!------====-- CONTENT GOES ABOVE ------->


<!-----------------------[  Deployment (CI/CD)  ]-----------<optional> section below--------------------->
### Deployment (CI/CD)

<!-- 
INSTRUCTIONS:
- Describe how to deploy if applicable. Deployment includes website deployment, packages, or artifacts.
- Avoid potential new contributor frustrations by making it easy to know about all compliance and continuous integration 
    that will be run before pull request approval.
- NOTE: Setting up an Azure DevOps pipeline gets you all 1ES compliance and build tooling such as component governance. 
  - More info: https://aka.ms/StartRight/README-Template/integrate-ado

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#deployment-and-continuous-integration
-->

<!---- [TODO]  CONTENT GOES BELOW ------->
_At this time, the repository does not use continuous integration or produce a website, artifact, or anything deployed._
<!------====-- CONTENT GOES ABOVE ------->


<!-----------------------[  Versioning and Changelog  ]-----<optional> section below--------------------->

<!-- ### Versioning and Changelog -->

<!-- 
INSTRUCTIONS:
- If there is any information on a changelog, history, versioning style, roadmap or any related content tied to the 
  history and/or future of your project, this is a section for it.

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#versioning-and-changelog
-->

<!---- [TODO]  CONTENT GOES BELOW ------->
<!-- We use [SemVer](https://aka.ms/StartRight/README-Template/semver) for versioning. -->
<!------====-- CONTENT GOES ABOVE ------->


-----------------------------------------------

<!-----------------------[  Access  ]-----------------------<recommended> section below------------------>
## Access

<!-- 
INSTRUCTIONS:
- Please use this section to reduce the all-too-common friction & pain of getting read access and role-based permissions 
  to repos inside Microsoft. Please cover (a) Gaining a role with read, write, other permissions. (b) sharing a link to 
  this repository such that people who are not members of the organization can access it.
- If the repository is set to internalVisibility, you may also want to refer to the "Sharing a Link to this Repository" sub-section 
of the [README-Template instructions](https://aka.ms/StartRight/README-Template/Instructions#sharing-a-link-to-this-repository) so new GitHub EMU users know to get 1ES-Enterprise-Visibility MyAccess group access and therefore will have read rights to any repo set to internalVisibility.

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#how-to-share-an-accessible-link-to-this-repository
-->


<!---- [TODO]  CONTENT GOES BELOW ------->

<!------====-- CONTENT GOES ABOVE ------->


<!-----------------------[  Contributing  ]-----------------<recommended> section below------------------>
## Contributing

<!--
INSTRUCTIONS: 
- Establish expectations and processes for existing & new developers to contribute to the repository.
  - Describe whether first step should be email, teams message, issue, or direct to pull request.
  - Express whether fork or branch preferred.
- CONTRIBUTING content Location:
  - You can tell users how to contribute in the README directly or link to a separate CONTRIBUTING.md file.
  - The README sections "Contacts" and "Reuse Expectations" can be seen as subsections to CONTRIBUTING.
  
How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#contributing
-->

<!---- [TODO]  CONTENT GOES BELOW ------->
_This repository prefers outside contributors start forks rather than branches. For pull requests more complicated 
than typos, it is often best to submit an issue first._

If you are a new potential collaborator who finds reaching out or contributing to another project awkward, you may find 
it useful to read these [tips & tricks](https://aka.ms/StartRight/README-Template/innerSource/2021_02_TipsAndTricksForCollaboration) 
on InnerSource Communication.
<!------====-- CONTENT GOES ABOVE ------->


<!-----------------------[  Contacts  ]---------------------<recommended> section below------------------>
<!-- 
#### Contacts  
-->
<!--
INSTRUCTIONS: 
- To lower friction for new users and contributors, provide a preferred contact(s) and method (email, TEAMS, issue, etc.)

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#contacts
-->

<!---- [TODO]  CONTENT GOES BELOW ------->

<!------====-- CONTENT GOES ABOVE ------->


<!-----------------------[  Support & Reuse Expectations  ]-----<recommended> section below-------------->
 
### Support & Reuse Expectations

 
<!-- 
INSTRUCTIONS:
- To avoid misalignments use this section to set expectations in regards to current and future state of:
  - The level of support the owning team provides new users/contributors and 
  - The owning team's expectations in terms of incoming InnerSource requests and contributions.

How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#support-and-reuse-expectations
-->

<!---- [TODO]  CONTENT GOES BELOW ------->

_The creators of this repository **DO NOT EXPECT REUSE**._

If you do use it, please let us know via an email or 
leave a note in an issue, so we can best understand the value of this repository.
<!------====-- CONTENT GOES ABOVE ------->


<!-----------------------[  Limitations  ]----------------------<optional> section below----------------->

<!-- 
### Limitations 
--> 

<!-- 
INSTRUCTIONS:
- Use this section to make readers aware of any complications or limitations that they need to be made aware of.
  - State:
    - Export restrictions
    - If telemetry is collected
    - Dependencies with non-typical license requirements or limitations that need to not be missed. 
    - trademark limitations
 
How to Evaluate & Examples:
  - https://aka.ms/StartRight/README-Template/Instructions#limitations
-->

<!---- [TODO]  CONTENT GOES BELOW ------->

<!------====-- CONTENT GOES ABOVE ------->

--------------------------------------------


<!-----------------------[  Links to Platform Policies  ]-------<recommended> section below-------------->
## How to Accomplish Common User Actions
<!-- 
INSTRUCTIONS: 
- This section links to information useful to any user of this repository new to internal GitHub policies & workflows.
-->

 If you have trouble doing something related to this repository, please keep in mind that the following actions require 
 using [GitHub inside Microsoft (GiM) tooling](https://aka.ms/gim/docs) and not the normal GitHub visible user interface!
- [Switching between EMU GitHub and normal GitHub without logging out and back in constantly](https://aka.ms/StartRight/README-Template/maintainingMultipleAccount)
- [Creating a repository](https://aka.ms/StartRight)
- [Changing repository visibility](https://aka.ms/StartRight/README-Template/policies/jit) 
- [Gaining repository permissions, access, and roles](https://aka.ms/StartRight/README-TEmplates/gim/policies/access)
- [Enabling easy access to your low sensitivity and widely applicable repository by setting it to Internal Visibility and having any FTE who wants to see it join the 1ES Enterprise Visibility MyAccess Group](https://aka.ms/StartRight/README-Template/gim/innersource-access)
- [Migrating repositories](https://aka.ms/StartRight/README-Template/troubleshoot/migration)
- [Setting branch protection](https://aka.ms/StartRight/README-Template/gim/policies/branch-protection)
- [Setting up GitHubActions](https://aka.ms/StartRight/README-Template/policies/actions)
- [and other actions](https://aka.ms/StartRight/README-Template/gim/policies)

This README started as a template provided as part of the 
[StartRight](https://aka.ms/gim/docs/startright) tool that is used to create new repositories safely. Feedback on the
[README template](https://aka.ms/StartRight/README-Template) used in this repository is requested as an issue. 

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
