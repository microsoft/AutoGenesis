# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""SSH tunnel management — establish and tear down ``ssh -L`` tunnels."""

from __future__ import annotations

import socket
import subprocess
import time

from utils.logger import get_mcp_logger

logger = get_mcp_logger()


def start_tunnel(
    vm_ip: str,
    *,
    local_port: int = 4723,
    remote_port: int = 4723,
    user: str = "admin",
    password: str,
) -> subprocess.Popen:
    """Start a background ``ssh -L`` tunnel and return the Popen handle."""
    cmd = [
        "sshpass", "-p", password,
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-N",
        "-L", f"{local_port}:127.0.0.1:{remote_port}",
        f"{user}@{vm_ip}",
    ]
    logger.info(f"Starting SSH tunnel: localhost:{local_port} → {vm_ip}:{remote_port}")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return proc


def stop_tunnel(proc: subprocess.Popen | None) -> None:
    if proc is None:
        return
    logger.info("Stopping SSH tunnel")
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def wait_tunnel_ready(local_port: int = 4723, timeout: int = 15) -> None:
    """Poll until localhost:local_port accepts a TCP connection."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", local_port), timeout=2):
                logger.info(f"Tunnel ready on localhost:{local_port}")
                return
        except OSError:
            time.sleep(1)
    raise RuntimeError(f"Tunnel on localhost:{local_port} not ready within {timeout}s")
