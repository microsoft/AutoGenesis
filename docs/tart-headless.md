# Tart Headless 模式

## 概述

AutoGenesis 使用 Tart 在 Apple Silicon macOS 宿主机上运行隔离的 macOS VM，并将
Appium Mac2 自动化透明地路由到 VM。MCP 工具层不需要区分本地模式和 VM 模式。

当前使用的精简镜像由 FSQ-lab 维护：

```text
ghcr.io/FSQ-lab/macos-xcode-slim:latest
```

2026-07-30 本机缓存对应的 OCI 摘要为：

```text
sha256:7dacef1549af3a11d860409da6f722d29481f88d649e27b5ac68e11f73c48728
```

`latest` 标签可能更新。需要完全可复现的环境时，应在配置中使用摘要固定版本。

## 架构

```text
首个 MCP 工具调用
  -> 读取 MAC_VM 配置
  -> 检查宿主机依赖
  -> 拉取镜像并克隆 VM（managed=true）
  -> 无图形界面启动 Tart VM
  -> 获取 VM IP
  -> SSH provision Appium 和 Mac2 Driver（managed=true）
  -> 在 VM 内启动 Appium :4723
  -> 建立 SSH 本地端口转发
  -> Appium Client 连接 http://127.0.0.1:4723
```

相关代码：

- `appium-mcp-server/headless/vm.py`：Tart VM 生命周期、provision 和应用安装。
- `appium-mcp-server/headless/tunnel.py`：SSH 隧道创建、就绪检测和关闭。
- `appium-mcp-server/headless/config.py`：`MAC_VM` 配置解析。
- `appium-mcp-server/headless/cli.py`：VM 初始化和运维命令。
- `appium-mcp-server/driver_session.py`：在首次工具调用时惰性初始化 VM。
- `appium-mcp-server/simple_server.py`：向 session manager 注入完整配置并在退出时清理资源。

## 宿主机要求

- Apple Silicon Mac
- Homebrew
- Tart
- sshpass

代码会在缺少依赖时尝试通过 Homebrew 安装 Tart 和 sshpass。也可以提前安装：

```bash
brew install cirruslabs/cli/tart
brew install hudochenkov/sshpass/sshpass
```

本地核对时使用的 Tart 版本为 `2.32.1`。

## 配置

参考仓库根目录的 `bdd_ai_conf_headless.json`：

```json
{
  "MAC_VM": {
    "enabled": true,
    "name": "autogenesis-vm",
    "image": "ghcr.io/FSQ-lab/macos-xcode-slim:latest",
    "managed": true,
    "user": "admin",
    "password": "",
    "stop_on_exit": false
  }
}
```

字段说明：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 是否启用 Tart Headless 模式 |
| `name` | `autogenesis-vm` | 本地 Tart VM 名称 |
| `image` | Cirrus Labs macOS 镜像 | `managed=true` 时用于创建 VM 的 OCI 镜像 |
| `managed` | `true` | 自动创建并 provision；设为 `false` 时使用已有 VM |
| `user` | `admin` | VM SSH 用户 |
| `password` | 无 | VM SSH 密码，也可通过 `AUTOGENESIS_VM_PASSWORD` 提供 |
| `stop_on_exit` | `false` | MCP Server 退出时是否停止 VM |

不要提交真实密码、API Key、私有 registry token 或包含这些内容的本地配置。推荐在启动 MCP 前设置环境变量：

```bash
export AUTOGENESIS_VM_PASSWORD='your-local-vm-password'
```

也可以只在未提交的本地配置中填写 `password`。示例文件不包含真实凭据。

## 生命周期

### 首次运行

1. `tart list --format json` 检查 VM 是否存在。
2. `tart pull` 拉取 OCI 镜像。
3. `tart clone` 创建本地 VM。
4. `tart run <name> --no-graphics` 启动 VM。
5. `tart ip <name>` 获取地址。
6. SSH 安装 Homebrew、Node.js、Appium 和 Mac2 Driver。
7. 启动 Appium，并建立 `localhost:4723` SSH 隧道。

Provision 完成后，宿主机会创建 `~/.autogenesis/vm/<name>.json` 状态文件，后续启动跳过重复安装。

### 后续运行

已有 VM 和 provision 状态时，只需启动 VM、确认 Appium 并重建 SSH 隧道。

### 退出

MCP Server 退出时关闭 Appium session 和 SSH 隧道。仅当 `stop_on_exit=true` 时停止 Tart VM；默认保留 VM 运行状态以缩短下次启动时间。

## CLI 运维

在 `appium-mcp-server` 目录执行：

```bash
python -m headless.cli --config ../bdd_ai_conf_headless.json init
python -m headless.cli --config ../bdd_ai_conf_headless.json status
python -m headless.cli --config ../bdd_ai_conf_headless.json stop
python -m headless.cli --config ../bdd_ai_conf_headless.json reset-provision
```

常用 Tart 检查命令：

```bash
tart list --format json
tart ip autogenesis-vm
```

## 应用安装

`MAC_VM.app_install` 支持三种互斥方式：

```json
{ "app_install": { "brew": "microsoft-edge" } }
```

```json
{ "app_install": { "dmg_url": "https://example.invalid/app.dmg" } }
```

```json
{ "app_install": { "local_path": "/path/to/App.app" } }
```

分别对应 Homebrew Cask、VM 内下载 DMG，以及通过 rsync 上传本地 `.app`。

## 已知限制

- 本地转发端口固定为 `4723`，不能同时运行占用该端口的其他 Appium 实例。
- SSH 使用密码认证和 `sshpass`，生产环境更适合改为 SSH Key 或短期凭据。
- Provision 状态保存在宿主机；VM 被替换后应执行 `reset-provision`。
- macOS Accessibility 权限需要镜像预配置或在 VM 内单独授权。
- `managed=false` 要求指定 VM 已存在，并且具备可用的 SSH 和 Appium 环境。