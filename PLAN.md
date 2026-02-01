# AutoGenesis 改造计划：通用开源 AI 测试工具

## 目标
将 AutoGenesis 改造为一个**统一的 AI Agent**，支持测试任意客户端应用（桌面、移动端，未来支持 Web），并可从 Claude Code、VS Code Copilot 或 CLI 调用。

---

## 核心机制：录制-回放架构

AutoGenesis 的核心价值在于**"录制-回放"**机制，实现了 AI 辅助测试创建与确定性测试执行的分离：

```
┌─────────────────────────────────────────────────────────────────────┐
│           第一阶段：AI 辅助录制 (需要 LLM，只执行一次)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. before_gen_code(feature_file, step_file)  ← 初始化录制会话     │
│                          ↓                                          │
│   2. LLM 理解 BDD 步骤，调用 MCP 工具执行                            │
│      • click_element("登录按钮")                                    │
│      • send_keys("用户名", "test@example.com")                      │
│      • ...每次调用被记录到 gen_code_cache                            │
│                          ↓                                          │
│   3. preview_code_changes()  ← 预览生成的 Python 代码               │
│                          ↓                                          │
│   4. confirm_code_changes()  ← 保存到 features/steps/*.py           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
                    生成的步骤定义代码示例：
                    ┌─────────────────────────────────────┐
                    │ @step('I click the login button')   │
                    │ def step_impl(context):             │
                    │     result = call_tool_sync(        │
                    │         context,                    │
                    │         context.session.call_tool(  │
                    │             name="click_element",   │
                    │             arguments={             │
                    │                 "locator": "登录按钮"│
                    │             }                       │
                    │         )                           │
                    │     )                               │
                    └─────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│           第二阶段：确定性回放 (无需 LLM，可重复执行)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   $ behave features/login.feature                                   │
│                          ↓                                          │
│   直接执行生成的 Python 步骤定义                                     │
│   • 参数已硬编码，无需 LLM 解析                                      │
│   • 直接调用 MCP 工具                                               │
│   • 完全确定性执行                                                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│   ✅ 优势：                                                          │
│   • 无 LLM 幻觉风险 - 参数在录制时已确定                             │
│   • 执行速度快 - 无 API 调用延迟                                     │
│   • 结果可重复、可预测                                               │
│   • 可集成到 CI/CD 流水线                                           │
│   • 降低测试运行成本 - 不消耗 LLM tokens                             │
└─────────────────────────────────────────────────────────────────────┘
```

**改造原则：** 所有架构变更必须保持此"录制-回放"核心机制不变。

---

## 第三阶段：失败分析与脚本自愈

当回放阶段测试失败时，AutoGenesis 提供智能分析和自动修复能力。

### 完整失败处理流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         测试执行失败处理流程                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    $ behave features/login.feature
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │     测试步骤执行失败       │
                    │  Step: "点击登录按钮"      │
                    │  Error: Element not found │
                    └──────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
   ┌───────────┐           ┌───────────┐           ┌───────────┐
   │ 收集上下文 │           │ 截取当前  │           │ 获取 UI   │
   │ 错误信息  │           │ 页面截图  │           │ 树结构    │
   └───────────┘           └───────────┘           └───────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    步骤 1: 初步分析 (无需 LLM)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  基于规则的快速分类：                                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 检查错误类型:                                                        │   │
│  │ • ConnectionError/Timeout → 环境问题 (网络/设备)                    │   │
│  │ • ElementNotFound/StaleElement → 可能是脚本问题                     │   │
│  │ • AssertionError (验证失败) → 可能是产品缺陷                        │   │
│  │ • SessionNotCreated → 环境问题 (Appium/设备)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 快速检查:                                                            │   │
│  │ • 元素定位器在当前 UI 树中是否存在？                                  │   │
│  │ • 页面结构与录制时是否一致？                                         │   │
│  │ • 是否有明显的页面加载/状态问题？                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ 需要深度分析?                │
                    │ (初步判断不确定/置信度低)    │
                    └──────────────┬──────────────┘
                          │                │
                   是     │                │ 否 (高置信度)
                          ▼                ▼
┌─────────────────────────────────┐  ┌────────────────────────────────────┐
│  步骤 2: 深度分析 (调用 LLM)    │  │ 跳过深度分析，直接进入下一步       │
├─────────────────────────────────┤  └────────────────────────────────────┘
│                                 │                │
│  LLM 分析输入:                  │                │
│  • 错误信息                     │                │
│  • 当前截图                     │                │
│  • 当前 UI 树                   │                │
│  • 录制时的 UI 树 (如有)        │                │
│  • 失败步骤的预期行为           │                │
│                                 │                │
│  LLM 分析输出:                  │                │
│  • 失败分类 + 置信度            │                │
│  • 详细原因分析                 │                │
│  • 建议的修复方向               │                │
│                                 │                │
└─────────────────────────────────┘                │
                    │                              │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    步骤 3: 失败分类决策                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        失败分类结果                                  │  │
│   ├─────────────────────────────────────────────────────────────────────┤  │
│   │                                                                     │  │
│   │  🔧 SCRIPT_ISSUE (脚本问题)          ──────────────→ 进入自愈流程   │  │
│   │     • 元素定位器失效 (ID/XPath 变化)                                │  │
│   │     • 页面结构变化导致定位失败                                      │  │
│   │     • 等待时间不足                                                  │  │
│   │     • 操作顺序需要调整                                              │  │
│   │                                                                     │  │
│   │  🐛 PRODUCT_BUG (产品缺陷)           ──────────────→ 报告为 BUG     │  │
│   │     • 功能行为与预期不符                                            │  │
│   │     • 验证点失败 (文本/状态不正确)                                  │  │
│   │     • 崩溃/异常退出                                                 │  │
│   │     • UI 渲染错误                                                   │  │
│   │                                                                     │  │
│   │  ⏱️ ENVIRONMENT (环境问题)           ──────────────→ 提示重试       │  │
│   │     • 网络超时                                                      │  │
│   │     • 设备连接断开                                                  │  │
│   │     • Appium 会话失效                                               │  │
│   │     • 资源不足 (内存/CPU)                                          │  │
│   │                                                                     │  │
│   │  ❓ UNDETERMINED (待定)              ──────────────→ 人工介入       │  │
│   │     • 无法确定原因                                                  │  │
│   │     • 多种可能性                                                    │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 如果是 SCRIPT_ISSUE
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    步骤 4: 脚本自愈流程                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  4.1 查找替代定位器                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 在当前 UI 树中搜索:                                                  │   │
│  │ • 相似文本的元素                                                     │   │
│  │ • 相同类型的元素                                                     │   │
│  │ • 相对位置相近的元素                                                 │   │
│  │ • 具有相似属性的元素                                                 │   │
│  │                                                                     │   │
│  │ 生成候选定位器列表:                                                  │   │
│  │ 1. accessibility_id:signin_btn (置信度: 0.95)                       │   │
│  │ 2. xpath://XCUIElementTypeButton[@name='Sign In'] (置信度: 0.85)    │   │
│  │ 3. class_name:XCUIElementTypeButton[2] (置信度: 0.60)               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  4.2 生成修复代码                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 原代码:                                                              │   │
│  │   click_element(locator="accessibility_id:login_button")            │   │
│  │                                                                     │   │
│  │ 修复后:                                                              │   │
│  │   click_element(locator="accessibility_id:signin_btn")              │   │
│  │                                                                     │   │
│  │ 或者添加等待:                                                        │   │
│  │   wait_for_element(locator="...", timeout=10)                       │   │
│  │   click_element(locator="...")                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  4.3 Git 提交确认                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  自动创建 Git 分支并提交修复:                                        │   │
│  │                                                                     │   │
│  │  $ git checkout -b autogenesis/heal/login_button_20240130           │   │
│  │  $ git add features/steps/login_steps.py                            │   │
│  │  $ git commit -m "fix(heal): Update locator for login button        │   │
│  │                                                                     │   │
│  │    - Old: accessibility_id:login_button                             │   │
│  │    - New: accessibility_id:signin_btn                               │   │
│  │                                                                     │   │
│  │    Reason: Element ID changed after app update                      │   │
│  │    Confidence: 95%                                                  │   │
│  │    Auto-healed by AutoGenesis"                                      │   │
│  │                                                                     │   │
│  │  用户确认方式:                                                       │   │
│  │  • 查看 Git diff 和 commit message                                  │   │
│  │  • 接受: git merge autogenesis/heal/login_button_20240130           │   │
│  │  • 拒绝: git branch -D autogenesis/heal/login_button_20240130       │   │
│  │  • 或通过 PR 进行 Code Review                                       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 用户 merge 分支后
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    步骤 5: 验证修复                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  5.1 检测分支合并                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 监控 heal 分支是否被合并到主分支                                     │   │
│  │ 或用户手动触发验证: autogenesis verify --scenario "登录场景"         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  5.2 重新运行失败的测试                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ behave features/login.feature --name "登录场景" --no-capture        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                          │                                                  │
│            ┌─────────────┴─────────────┐                                   │
│            │                           │                                   │
│            ▼                           ▼                                   │
│     ┌───────────┐              ┌───────────┐                               │
│     │ 测试通过  │              │ 测试仍失败 │                               │
│     └───────────┘              └───────────┘                               │
│            │                           │                                   │
│            ▼                           ▼                                   │
│  ┌─────────────────┐        ┌─────────────────┐                            │
│  │ ✅ 修复成功      │        │ 标记需要人工    │                            │
│  │ • 清理 heal 分支 │        │ • 保留分支供参考 │                            │
│  │ • 更新测试报告  │        │ • 尝试其他方案  │                            │
│  │ • 继续执行      │        │ • 创建新 heal 分支│                            │
│  └─────────────────┘        └─────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    步骤 6: 生成分析报告                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 测试执行报告                                                             │
│  ═══════════════════════════════════════════════════════════════           │
│                                                                             │
│  Feature: 用户登录功能                                                      │
│  Scenario: 正常登录流程                                                     │
│                                                                             │
│  步骤执行结果:                                                               │
│  ┌────┬────────────────────────┬────────┬─────────────────────────────┐    │
│  │ #  │ 步骤                   │ 状态   │ 说明                        │    │
│  ├────┼────────────────────────┼────────┼─────────────────────────────┤    │
│  │ 1  │ 启动应用               │ ✅ 通过 │                             │    │
│  │ 2  │ 点击登录按钮           │ 🔧 自愈 │ 定位器已更新并验证通过      │    │
│  │ 3  │ 输入用户名             │ ✅ 通过 │                             │    │
│  │ 4  │ 输入密码               │ ✅ 通过 │                             │    │
│  │ 5  │ 点击提交               │ ✅ 通过 │                             │    │
│  │ 6  │ 验证登录成功           │ 🐛 失败 │ 产品缺陷: 登录后未跳转      │    │
│  └────┴────────────────────────┴────────┴─────────────────────────────┘    │
│                                                                             │
│  自愈记录:                                                                  │
│  • 步骤 2: accessibility_id:login_button → accessibility_id:signin_btn    │
│    原因: 应用更新后元素 ID 变更                                            │
│    修复时间: 2024-01-30 14:30:22                                           │
│                                                                             │
│  发现的缺陷:                                                                │
│  • BUG-001: 登录成功后页面未正确跳转到首页                                 │
│    严重程度: High                                                          │
│    截图: ./screenshots/bug_001.png                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 自愈模式配置

用户可以配置自愈行为：

```json
{
  "healing": {
    "enabled": true,
    "mode": "git_branch",          // git_branch | git_pr | disabled
    "branch_prefix": "autogenesis/heal/",
    "auto_verify_on_merge": true,  // 合并后自动验证
    "max_retries": 3,              // 最多尝试修复次数
    "confidence_threshold": 0.8,   // 创建分支的最低置信度
    "cleanup_on_success": true     // 成功后自动删除 heal 分支
  },
  "git": {
    "create_pr": false,            // 是否自动创建 PR
    "pr_labels": ["auto-heal"],    // PR 标签
    "assign_reviewers": []         // 自动分配 reviewer
  }
}
```

**模式说明：**
- `git_branch`: 创建独立分支，用户手动 merge 确认（默认）
- `git_pr`: 自动创建 Pull Request，通过 PR Review 确认
- `disabled`: 禁用自愈，仅生成分析报告

**Git 分支命名规范：**
```
autogenesis/heal/{element_name}_{timestamp}
例如: autogenesis/heal/login_button_20240130_143022
```

---

## 功能总结

### 🤖 统一 AI Agent 核心能力

| 功能 | 描述 |
|------|------|
| **自然语言测试执行** | 用自然语言描述测试步骤，Agent 自动选择合适的技能执行 |
| **跨平台自动切换** | 根据任务自动识别目标平台（iOS/Android/Windows/Mac） |
| **上下文记忆** | 在多轮对话中保持测试上下文，支持复杂测试场景 |
| **BDD 代码自动生成** | 执行测试步骤后自动生成 Behave 步骤定义代码 |

### 📱 Mobile Skill (iOS/Android)

| 功能 | 工具 |
|------|------|
| 启动/关闭应用 | `app_launch`, `app_close` |
| 元素定位与点击 | `find_element`, `click_element`, `tap_coordinates` |
| 文本输入 | `send_keys` |
| 手势操作 | `swipe`, `pinch_zoom`, `double_click_element` |
| 滚动查找元素 | `scroll_to_element` |
| 开关控件操作 | `switch_element_to_on/off` |
| 获取页面结构 | `get_page_source_tree` |
| 视觉验证 (LLM) | `verify_visual_task` - 用 AI 判断界面是否符合预期 |
| 云测试支持 | BrowserStack 集成 |

### 🖥️ Desktop Windows Skill

| 功能 | 工具 |
|------|------|
| 启动/关闭应用 | `app_launch`, `app_close` |
| 截图 | `app_screenshot` |
| 元素点击 | `element_click`, `right_click` |
| 键盘输入 | `send_keystrokes`, `enter_text` |
| 文件夹/树展开 | `open_folder` |
| 列表/菜单选择 | `select_item` |
| 鼠标操作 | 完整鼠标控制 |

### 🍎 Desktop Mac Skill

| 功能 | 工具 |
|------|------|
| 启动/关闭应用 | `app_launch`, `app_close` |
| 元素交互 | 点击、输入、滚动 |
| Mac 原生控件 | 支持 macOS 原生 UI 元素 |
| 辅助功能 API | 通过 Mac2 驱动访问 |

### 🔌 IDE 集成方式

| 集成方式 | 功能 |
|------|------|
| **Claude Code** | 直接在 Claude Code 中执行测试命令，Agent 作为 MCP 工具 |
| **VS Code Copilot** | CodeLens 按钮一键发送场景到 Copilot 执行 |
| **CLI** | 命令行独立运行测试 |

### 📝 BDD 测试工作流

```
1. 编写 Gherkin 场景 (.feature 文件)
       ↓
2. 通过 Claude Code/VS Code/CLI 发送给 Agent
       ↓
3. Agent 自动:
   • 解析测试步骤
   • 选择合适的 Skill
   • 执行自动化操作
   • 记录每一步调用
       ↓
4. 自动生成 Python 步骤定义代码
       ↓
5. 后续可直接用 `behave` 命令重复执行测试
```

### 🎯 使用示例

**在 Claude Code 中:**
```
用户: 在 iOS 上测试登录功能：启动应用，点击登录按钮，输入用户名 test@example.com，输入密码，点击提交

Agent:
1. 检测到移动测试任务，激活 Mobile Skill
2. 执行 app_launch
3. 执行 click_element (登录按钮)
4. 执行 send_keys (用户名)
5. 执行 send_keys (密码)
6. 执行 click_element (提交)
7. 生成对应的 Behave 步骤定义
```

---

## 新架构概览

```
┌─────────────────────────────────────────────────────────┐
│                   统一 AI Agent                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           AgentCoordinator (核心协调器)           │   │
│  │  • 任务路由 • 上下文管理 • 技能加载 • LLM 集成    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Agent Skills (技能层)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Mobile   │ │ Desktop  │ │ Desktop  │ │ Web      │   │
│  │ Skill    │ │ Windows  │ │ Mac      │ │ Skill    │   │
│  │ (iOS/    │ │ Skill    │ │ Skill    │ │ (未来)   │   │
│  │ Android) │ │          │ │          │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   MCP Server (入口层)                   │
│  unified_mcp_server.py                                  │
│  • stdio/sse 传输 • Claude Code 支持 • VS Code 支持    │
└─────────────────────────────────────────────────────────┘
```

---

## 新项目结构

```
AutoGenesis/
├── core/                           # 核心共享功能
│   ├── agent/
│   │   ├── agent_coordinator.py    # AI Agent 协调器
│   │   ├── context_manager.py      # 上下文管理
│   │   └── skill_loader.py         # 技能动态加载
│   ├── llm/                        # 整合后的 LLM 集成
│   │   ├── chat.py                 # 多 LLM 支持
│   │   └── prompt.py               # 提示词模板
│   ├── utils/                      # 共享工具
│   │   ├── response_format.py
│   │   └── logger.py
│   ├── bdd/                        # BDD 代码生成
│   │   └── gen_code.py
│   └── analysis/                   # 新增：结果分析模块
│       ├── result_analyzer.py      # 失败分析器
│       ├── script_healer.py        # 脚本自愈器
│       ├── failure_classifier.py   # 失败分类器
│       └── report_generator.py     # 报告生成器
│
├── skills/                         # 技能层
│   ├── base_skill.py               # 技能抽象基类
│   ├── mobile_skill/               # 移动测试技能 (从 appium-mcp-server 重构)
│   │   ├── skill_manifest.json
│   │   ├── session_manager.py
│   │   └── tools/
│   ├── desktop_windows_skill/      # Windows 桌面技能 (从 pywinauto-mcp-server 重构)
│   │   ├── skill_manifest.json
│   │   ├── session_manager.py
│   │   └── tools/
│   └── desktop_mac_skill/          # Mac 桌面技能 (从 mobile_skill 分离)
│       ├── skill_manifest.json
│       └── tools/
│
├── servers/                        # MCP 服务器
│   └── unified_mcp_server.py       # 统一入口
│
├── cli/                            # 命令行工具
│   └── main.py
│
├── ide_integrations/               # IDE 集成
│   ├── vscode_extension/           # 保留现有 VS Code 扩展
│   └── claude_code/                # Claude Code 配置模板和文档
│
├── examples/                       # 示例 (从 behave-demo 重构)
│   ├── mobile/
│   ├── desktop_windows/
│   └── desktop_mac/
│
└── docs/                           # 文档
```

---

## 实现步骤

### 第 1 步：创建核心基础设施
**文件:** `core/agent/agent_coordinator.py`, `core/agent/skill_loader.py`, `core/agent/context_manager.py`

- 实现 AgentCoordinator 类作为中央协调器
- 实现技能动态加载机制
- 实现跨工具调用的上下文管理

### 第 2 步：整合共享代码
**移动文件:**
- `appium-mcp-server/llm/*` → `core/llm/`
- `appium-mcp-server/utils/response_format.py` → `core/utils/`
- `appium-mcp-server/utils/gen_code.py` → `core/bdd/`

### 第 3 步：实现技能抽象
**文件:** `skills/base_skill.py`

```python
class BaseSkill(ABC):
    @abstractmethod
    async def initialize(self): pass

    @abstractmethod
    async def execute(self, task: str, context: Dict) -> Dict: pass

    @abstractmethod
    def get_available_tools(self) -> List[str]: pass
```

### 第 4 步：重构 Mobile Skill
**目录:** `skills/mobile_skill/`

- 从 `appium-mcp-server/` 迁移工具代码
- 创建 `skill_manifest.json` 定义能力
- 实现 `MobileSkill` 类继承 `BaseSkill`

### 第 5 步：重构 Desktop Windows Skill
**目录:** `skills/desktop_windows_skill/`

- 从 `pywinauto-mcp-server/` 迁移工具代码
- 创建技能清单和实现

### 第 6 步：分离 Desktop Mac Skill
**目录:** `skills/desktop_mac_skill/`

- 从 mobile_skill 中提取 Mac 特定代码
- 独立的 Mac2 驱动集成

### 第 7 步：实现统一 MCP 服务器
**文件:** `servers/unified_mcp_server.py`

```python
@mcp.tool()
async def execute_test_step(
    step_description: str,
    scenario: str = "",
    feature_file: str = "",
    platform: str = "auto"  # auto, mobile, desktop_windows, desktop_mac
) -> str:
    """执行 BDD 测试步骤，自动选择合适的技能"""
    result = await agent.execute_task(step_description, context)
    return json.dumps(result)
```

### 第 8 步：Claude Code 集成
**目录:** `ide_integrations/claude_code/`

创建配置模板 (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": ["/path/to/AutoGenesis/servers/unified_mcp_server.py"],
      "env": {"AUTOGENESIS_SKILL": "auto"}
    }
  }
}
```

### 第 9 步：更新 VS Code 扩展
**目录:** `ide_integrations/vscode_extension/`

- 更新 MCP 配置指向统一服务器
- 保持现有 CodeLens、代码生成功能

### 第 10 步：创建示例和文档
- 按平台组织示例项目
- 编写 Getting Started 文档
- 移除 Microsoft 特定引用

### 第 11 步：实现结果分析模块
**目录:** `core/analysis/`

**failure_classifier.py** - 失败分类器：
```python
class FailureClassifier:
    """分析测试失败并分类原因"""

    class FailureType(Enum):
        SCRIPT_ISSUE = "script_issue"      # 脚本问题（可自愈）
        PRODUCT_BUG = "product_bug"        # 产品缺陷
        ENVIRONMENT = "environment"        # 环境问题
        UNDETERMINED = "undetermined"      # 待定

    async def classify(
        self,
        error_message: str,
        current_screenshot: bytes,
        current_ui_tree: str,
        recorded_ui_tree: str = None
    ) -> FailureClassification:
        """
        分析失败原因并分类

        返回:
        - failure_type: 失败类型
        - confidence: 置信度 (0-1)
        - reason: 详细原因说明
        - evidence: 支撑证据
        """
```

**result_analyzer.py** - 结果分析器：
```python
class ResultAnalyzer:
    """分析 Behave 测试结果"""

    async def analyze_failure(
        self,
        feature_file: str,
        scenario_name: str,
        failed_step: str,
        error_info: dict
    ) -> AnalysisReport:
        """
        全面分析测试失败

        输出:
        - failure_classification: 失败分类
        - root_cause: 根本原因
        - ui_diff: UI 变化对比
        - recommendations: 修复建议
        """
```

### 第 12 步：实现脚本自愈模块
**文件:** `core/analysis/script_healer.py`

```python
class ScriptHealer:
    """自动修复失效的测试脚本"""

    async def heal(
        self,
        step_file: str,
        failed_step: str,
        analysis_report: AnalysisReport
    ) -> HealingResult:
        """
        生成修复建议并可选自动应用

        流程:
        1. 分析失败原因（定位器失效/超时/等）
        2. 获取当前页面状态
        3. LLM 生成新的定位策略
        4. 生成修复后的代码 diff
        5. 用户确认后应用
        """

    async def find_alternative_locator(
        self,
        original_locator: str,
        current_ui_tree: str
    ) -> List[LocatorSuggestion]:
        """查找替代定位器"""

    async def apply_fix(
        self,
        step_file: str,
        fix: CodeFix,
        backup: bool = True
    ) -> bool:
        """应用修复（创建备份）"""
```

---

## 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `core/agent/agent_coordinator.py` | 新建 | AI Agent 核心协调器 |
| `core/agent/context_manager.py` | 新建 | 上下文管理 |
| `core/agent/skill_loader.py` | 新建 | 技能加载器 |
| `core/analysis/result_analyzer.py` | 新建 | 测试结果分析器 |
| `core/analysis/failure_classifier.py` | 新建 | 失败分类器 |
| `core/analysis/script_healer.py` | 新建 | 脚本自愈模块 |
| `core/analysis/report_generator.py` | 新建 | 分析报告生成器 |
| `skills/base_skill.py` | 新建 | 技能抽象基类 |
| `skills/mobile_skill/__init__.py` | 新建 | 移动技能实现 |
| `skills/desktop_windows_skill/__init__.py` | 新建 | Windows 技能实现 |
| `skills/desktop_mac_skill/__init__.py` | 新建 | Mac 技能实现 |
| `servers/unified_mcp_server.py` | 新建 | 统一 MCP 服务器 |
| `core/llm/chat.py` | 移动 | 从 appium-mcp-server/llm/ |
| `core/utils/response_format.py` | 移动 | 从 appium-mcp-server/utils/ |
| `README.md` | 重写 | 通用开源说明 |
| `appium-mcp-server/simple_server.py` | 修改 | 添加废弃警告，指向统一服务器 |
| `pywinauto-mcp-server/simple_server.py` | 修改 | 添加废弃警告，指向统一服务器 |

---

## 验证步骤

### 1. 技能独立性测试
```bash
python -c "from skills.mobile_skill import MobileSkill; print('Mobile skill loaded')"
python -c "from skills.desktop_windows_skill import DesktopWindowsSkill; print('Windows skill loaded')"
```

### 2. Agent 初始化测试
```bash
python -c "
from core.agent import AgentCoordinator
import asyncio
agent = AgentCoordinator()
asyncio.run(agent.initialize())
print(f'Loaded skills: {list(agent.skills.keys())}')
"
```

### 3. Claude Code 集成测试
- 配置 `~/.claude/settings.json`
- 启动 Claude Code
- 测试: "Launch the iOS app and tap the login button"
- 预期: 工具调用成功，返回操作结果

### 4. BDD 代码生成测试
```bash
# 执行示例场景
cd examples/mobile
behave features/demo.feature

# 检查生成的步骤定义
ls -la features/steps/
```

### 5. 向后兼容性测试
```bash
# 旧服务器应显示废弃警告但仍可工作
python appium-mcp-server/simple_server.py --platform ios --transport stdio
```

### 6. 结果分析模块测试
```bash
# 模拟失败场景，验证分析模块
python -c "
from core.analysis import ResultAnalyzer, FailureClassifier

# 测试失败分类
classifier = FailureClassifier()
result = asyncio.run(classifier.classify(
    error_message='Element not found: login_button',
    current_screenshot=screenshot_bytes,
    current_ui_tree=current_tree,
    recorded_ui_tree=recorded_tree
))
print(f'Failure type: {result.failure_type}')
print(f'Confidence: {result.confidence}')
"
```

### 7. 脚本自愈测试
```bash
# 测试自愈功能
python -c "
from core.analysis import ScriptHealer

healer = ScriptHealer()
suggestions = asyncio.run(healer.find_alternative_locator(
    original_locator='accessibility_id:login_button',
    current_ui_tree=current_tree
))
for s in suggestions:
    print(f'Alternative: {s.locator} (confidence: {s.confidence})')
"
```

---

## 开源准备

### 需移除的 Microsoft 特定引用
- `README.md`: 移除 `fsqgroup@microsoft.com`
- `behave-demo/features/environment.py`: 移除 `com.microsoft.emmx` 默认包名
- `appium-mcp-server/utils/gen_code.py`: 移除硬编码的 Microsoft 包名模式

### 需添加的内容
- 通用的安装脚本 (`install.sh`)
- 完整的 API 文档
- 贡献指南更新
- GitHub Actions CI/CD
