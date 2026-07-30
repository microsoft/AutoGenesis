# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""
CLI for manually managing headless VMs.

Usage:
  # Init a managed VM (pull image + clone + start + provision + verify Appium):
  python -m headless.cli init

  # Init with custom config file:
  python -m headless.cli init --config /path/to/bdd_ai_conf.json

  # Init an unmanaged VM (just start + verify Appium):
  python -m headless.cli init --name my-vm --no-managed

  # Check VM status:
  python -m headless.cli status

  # Stop VM:
  python -m headless.cli stop

  # Reset provisioning state (force re-provision on next init):
  python -m headless.cli reset-provision
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Allow running from appium-mcp-server/ directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from headless.config import VMConfig
from headless.vm import (
    ensure_vm, start_vm, stop_vm, get_ip,
    provision, ensure_appium, install_app,
    ensure_host_deps,
    is_provisioned, _vm_status, _STATE_DIR,
)
from headless.tunnel import start_tunnel, wait_tunnel_ready, stop_tunnel


def _load_vm_config(args) -> VMConfig:
    """Build VMConfig from CLI args or config file."""
    if args.config:
        with open(args.config) as f:
            conf = json.load(f)
        return VMConfig.from_dict(conf.get("MAC_VM"))

    return VMConfig(
        enabled=True,
        name=args.name,
        image=args.image,
        managed=args.managed,
        user=args.user,
        password=args.password,
    )


def cmd_init(args):
    cfg = _load_vm_config(args)
    cfg.validate()

    print("--- Checking host dependencies …")
    ensure_host_deps()

    print(f"VM name:    {cfg.name}")
    print(f"Managed:    {cfg.managed}")

    if cfg.managed:
        print(f"Image:      {cfg.image}")
        print("--- Ensuring VM exists …")
        ensure_vm(cfg.name, cfg.image)

    print("--- Starting VM …")
    start_vm(cfg.name)

    ip = get_ip(cfg.name)
    print(f"--- VM IP:  {ip}")

    if cfg.managed:
        print("--- Provisioning (idempotent) …")
        provision(ip, cfg.user, cfg.password, cfg.name)

    if cfg.app_install:
        print("--- Installing app …")
        install_app(ip, cfg.user, cfg.password, cfg.app_install)

    print("--- Ensuring Appium is running …")
    ensure_appium(ip, cfg.user, cfg.password)

    print("--- Done! VM is ready.")
    print(f"    Appium: http://{ip}:4723")
    print(f"    SSH:    ssh {cfg.user}@{ip}")


def cmd_status(args):
    cfg = _load_vm_config(args)
    status = _vm_status(cfg.name)
    if status is None:
        print(f"VM '{cfg.name}' does not exist")
        sys.exit(1)
    print(f"VM '{cfg.name}': {status}")
    print(f"Provisioned: {is_provisioned(cfg.name)}")
    if status == "running":
        try:
            ip = get_ip(cfg.name, timeout=10)
            print(f"IP: {ip}")
        except RuntimeError:
            print("IP: (not available)")


def cmd_stop(args):
    cfg = _load_vm_config(args)
    print(f"Stopping VM '{cfg.name}' …")
    stop_vm(cfg.name)
    print("Done")


def cmd_reset_provision(args):
    cfg = _load_vm_config(args)
    state_file = _STATE_DIR / f"{cfg.name}.json"
    if state_file.exists():
        state_file.unlink()
        print(f"Provisioning state cleared for '{cfg.name}'")
    else:
        print(f"No provisioning state found for '{cfg.name}'")


def main():
    parser = argparse.ArgumentParser(
        prog="headless",
        description="Manage AutoGenesis headless VMs",
    )
    parser.add_argument("--config", type=str, help="Path to bdd_ai_conf.json")
    parser.add_argument("--name", default="autogenesis-vm", help="VM name")
    parser.add_argument("--image", default="ghcr.io/cirruslabs/macos-sequoia-xcode:latest")
    parser.add_argument("--user", default="admin")
    parser.add_argument("--password", default=os.getenv("AUTOGENESIS_VM_PASSWORD", ""))
    parser.add_argument("--managed", default=True, action=argparse.BooleanOptionalAction,
                        help="--no-managed for user-owned VMs")

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init", help="Initialize and start the VM")
    sub.add_parser("status", help="Show VM status")
    sub.add_parser("stop", help="Stop the VM")
    sub.add_parser("reset-provision", help="Clear provisioning state")

    args = parser.parse_args()
    {
        "init": cmd_init,
        "status": cmd_status,
        "stop": cmd_stop,
        "reset-provision": cmd_reset_provision,
    }[args.command](args)


if __name__ == "__main__":
    main()
