# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""Tart VM lifecycle management — clone, start, stop, get IP, provision."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

from utils.logger import get_mcp_logger

logger = get_mcp_logger()

_STATE_DIR = Path.home() / ".autogenesis" / "vm"

# Host-side dependencies needed before any VM operation
_HOST_DEPS = [
    # (binary, brew install command)
    ("tart", "brew install cirruslabs/cli/tart"),
    ("sshpass", "brew install hudochenkov/sshpass/sshpass"),
]


def ensure_host_deps() -> None:
    """Check and install host-side dependencies (tart, sshpass) via Homebrew."""
    import shutil

    # First ensure brew itself exists
    if not shutil.which("brew"):
        raise RuntimeError(
            "Homebrew is required but not installed.\n"
            "Install it: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        )

    for binary, install_cmd in _HOST_DEPS:
        if shutil.which(binary):
            continue
        logger.info(f"'{binary}' not found, installing …")
        result = subprocess.run(install_cmd.split(), capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Failed to install {binary}: {result.stderr}")
        logger.info(f"'{binary}' installed")


def _run(cmd: list[str], *, check: bool = True, quiet: bool = False, **kwargs) -> subprocess.CompletedProcess:
    if not quiet:
        logger.info(f"Running: {' '.join(cmd)}")
    return subprocess.run(cmd, capture_output=True, text=True, check=check, **kwargs)


def _vm_status(name: str, quiet: bool = False) -> str | None:
    """Return VM status string (e.g. 'running', 'stopped') or None if not found."""
    result = _run(["tart", "list", "--format", "json"], check=False, quiet=quiet)
    if result.returncode != 0:
        return None
    for vm in json.loads(result.stdout):
        if vm.get("Name") == name:
            return vm.get("State", vm.get("status", "")).lower()
    return None


def ensure_vm(name: str, image: str) -> None:
    """Idempotent: clone image → VM if it doesn't already exist."""
    status = _vm_status(name)
    if status is not None:
        logger.info(f"VM '{name}' already exists (status={status}), skipping clone")
        return

    logger.info(f"Pulling image {image} …")
    _run(["tart", "pull", image], check=False)  # may already be cached

    logger.info(f"Cloning {image} → {name}")
    _run(["tart", "clone", image, name])
    logger.info(f"VM '{name}' created")


def start_vm(name: str) -> None:
    """Idempotent: start only if not already running."""
    status = _vm_status(name)
    if status == "running":
        logger.info(f"VM '{name}' is already running")
        return
    if status is None:
        raise RuntimeError(f"VM '{name}' does not exist — call ensure_vm first")

    logger.info(f"Starting VM '{name}' …")
    # Capture stderr to a pipe so we can detect errors like VM count limits
    proc = subprocess.Popen(
        ["tart", "run", name, "--no-graphics"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    # Wait until running, checking for early exit (error)
    for i in range(30):
        time.sleep(2)
        ret = proc.poll()
        if ret is not None:
            err = proc.stderr.read().decode().strip() if proc.stderr else ""
            raise RuntimeError(f"'tart run {name}' exited with code {ret}: {err}")
        if _vm_status(name, quiet=True) == "running":
            logger.info(f"VM '{name}' is running")
            return
    raise RuntimeError(f"VM '{name}' did not reach 'running' state within 60s")


def stop_vm(name: str) -> None:
    status = _vm_status(name)
    if status != "running":
        logger.info(f"VM '{name}' is not running (status={status}), nothing to stop")
        return
    logger.info(f"Stopping VM '{name}' …")
    _run(["tart", "stop", name], check=False)


def get_ip(name: str, timeout: int = 60) -> str:
    """Wait for VM to get an IP address."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _vm_status(name) != "running":
            raise RuntimeError(f"VM '{name}' is not running")
        result = _run(["tart", "ip", name], check=False)
        ip = result.stdout.strip()
        if ip and not ip.startswith("Error"):
            logger.info(f"VM '{name}' IP: {ip}")
            return ip
        time.sleep(2)
    raise RuntimeError(f"Could not obtain IP for VM '{name}' within {timeout}s")


def _ssh_cmd(ip: str, user: str, password: str, remote_cmd: str) -> subprocess.CompletedProcess:
    """Run a command on the VM via sshpass+ssh."""
    return _run([
        "sshpass", "-p", password,
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
        f"{user}@{ip}",
        f"source ~/.zprofile 2>/dev/null; {remote_cmd}",
    ], check=False)


def is_provisioned(name: str) -> bool:
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = _STATE_DIR / f"{name}.json"
    return state_file.exists()


def _mark_provisioned(name: str) -> None:
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = _STATE_DIR / f"{name}.json"
    state_file.write_text(json.dumps({"provisioned": True, "ts": time.time()}))


_PROVISION_STEPS = [
    # (description, check_cmd, install_cmd)
    (
        "Homebrew",
        "command -v brew",
        '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && '
        'echo \'eval "$(/opt/homebrew/bin/brew shellenv)"\' >> ~/.zprofile',
    ),
    (
        "Node.js",
        "command -v node",
        "brew install node",
    ),
    (
        "Appium",
        "command -v appium",
        "npm install -g appium",
    ),
    (
        "Mac2 driver",
        "appium driver list --installed 2>&1 | grep -q mac2",
        "appium driver install mac2",
    ),
]


def provision(ip: str, user: str, password: str, vm_name: str) -> None:
    """Idempotent: install Appium + Mac2 driver on the VM via SSH."""
    if is_provisioned(vm_name):
        logger.info(f"VM '{vm_name}' already provisioned, skipping")
        return

    logger.info(f"Provisioning VM '{vm_name}' at {ip} …")
    for desc, check_cmd, install_cmd in _PROVISION_STEPS:
        check = _ssh_cmd(ip, user, password, check_cmd)
        if check.returncode == 0:
            logger.info(f"{desc} already installed, skipping")
            continue
        logger.info(f"Installing {desc} …")
        result = _ssh_cmd(ip, user, password, install_cmd)
        if result.returncode != 0:
            logger.error(f"Failed to install {desc}: {result.stderr}")
            raise RuntimeError(f"Provision failed at '{desc}': {result.stderr}")

    _mark_provisioned(vm_name)
    logger.info(f"VM '{vm_name}' provisioned successfully")


def ensure_appium(ip: str, user: str, password: str) -> None:
    """Ensure Appium server is running on the VM."""
    # Check if Appium is already listening
    check = _ssh_cmd(ip, user, password, "lsof -i :4723 -sTCP:LISTEN")
    if check.returncode == 0 and check.stdout.strip():
        logger.info("Appium is already running on VM")
        return

    logger.info("Starting Appium on VM …")
    _ssh_cmd(ip, user, password,
             "nohup appium --address 0.0.0.0 --port 4723 "
             "> /tmp/appium.log 2>&1 &")
    # Wait for it to come up
    for _ in range(15):
        time.sleep(2)
        check = _ssh_cmd(ip, user, password, "lsof -i :4723 -sTCP:LISTEN")
        if check.returncode == 0 and check.stdout.strip():
            logger.info("Appium started on VM")
            return
    raise RuntimeError("Appium did not start on VM within 30s")


# ---------------------------------------------------------------------------
# App installation
# ---------------------------------------------------------------------------

def install_app_brew(ip: str, user: str, password: str, formula: str) -> None:
    """Install an app via ``brew install --cask`` on the VM."""
    logger.info(f"Installing app via brew: {formula}")
    # Check if already installed
    check = _ssh_cmd(ip, user, password, f"brew list --cask {formula}")
    if check.returncode == 0:
        logger.info(f"brew cask '{formula}' already installed, skipping")
        return
    result = _ssh_cmd(ip, user, password, f"brew install --cask {formula}")
    if result.returncode != 0:
        raise RuntimeError(f"brew install --cask {formula} failed: {result.stderr}")
    logger.info(f"App '{formula}' installed via brew")


def install_app_dmg(ip: str, user: str, password: str, dmg_url: str) -> None:
    """Download a .dmg from URL, mount it, and copy the .app to /Applications on the VM."""
    logger.info(f"Installing app from DMG: {dmg_url}")
    # Download → mount → copy → unmount, all in one SSH command
    script = (
        'set -e; '
        'DMG_PATH="/tmp/_autogenesis_app.dmg"; '
        f'curl -fSL -o "$DMG_PATH" "{dmg_url}"; '
        'MOUNT_DIR=$(hdiutil attach "$DMG_PATH" -nobrowse -readonly | tail -1 | awk \'{print $NF}\'); '
        'APP_PATH=$(find "$MOUNT_DIR" -maxdepth 1 -name "*.app" | head -1); '
        'if [ -z "$APP_PATH" ]; then echo "No .app found in DMG" >&2; exit 1; fi; '
        'cp -R "$APP_PATH" /Applications/; '
        'hdiutil detach "$MOUNT_DIR" -quiet; '
        'rm -f "$DMG_PATH"; '
        'echo "Installed: $(basename "$APP_PATH")"'
    )
    result = _ssh_cmd(ip, user, password, script)
    if result.returncode != 0:
        raise RuntimeError(f"DMG install failed: {result.stderr}")
    logger.info(f"App installed from DMG: {result.stdout.strip()}")


def install_app_local(ip: str, user: str, password: str, local_path: str) -> None:
    """Rsync a local .app bundle to /Applications on the VM."""
    local_path = os.path.expanduser(local_path)
    if not os.path.isdir(local_path):
        raise FileNotFoundError(f"Local app not found: {local_path}")
    app_name = os.path.basename(local_path)
    logger.info(f"Syncing local app to VM: {app_name}")
    result = _run([
        "sshpass", "-p", password,
        "rsync", "-az", "--delete",
        "-e", f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
        local_path,
        f"{user}@{ip}:/Applications/",
    ], check=False)
    if result.returncode != 0:
        raise RuntimeError(f"rsync failed: {result.stderr}")
    logger.info(f"App '{app_name}' synced to VM")


def install_app(ip: str, user: str, password: str, app_install) -> None:
    """Dispatch to the correct install method based on AppInstall config."""
    if app_install is None:
        return
    if app_install.brew:
        install_app_brew(ip, user, password, app_install.brew)
    elif app_install.dmg_url:
        install_app_dmg(ip, user, password, app_install.dmg_url)
    elif app_install.local_path:
        install_app_local(ip, user, password, app_install.local_path)
    else:
        logger.info("No app_install source configured, skipping app installation")
