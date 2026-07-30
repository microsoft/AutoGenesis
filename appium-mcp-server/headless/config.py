# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""Parse and validate the ``vm`` section of bdd_ai_conf.json."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class AppInstall:
    """How to install the test app into the VM. Three modes (mutually exclusive):

    - brew:       ``brew install --cask <formula>``
    - dmg_url:    download .dmg from URL, mount, copy .app to /Applications
    - local_path: rsync a local .app bundle into the VM
    """
    brew: str | None = None
    dmg_url: str | None = None
    local_path: str | None = None

    @classmethod
    def from_dict(cls, raw: dict | None) -> "AppInstall | None":
        if not raw:
            return None
        return cls(
            brew=raw.get("brew"),
            dmg_url=raw.get("dmg_url"),
            local_path=raw.get("local_path"),
        )


@dataclass
class VMConfig:
    enabled: bool = False
    name: str = "autogenesis-vm"
    image: str = "ghcr.io/cirruslabs/macos-sequoia-xcode:latest"
    managed: bool = True
    user: str = "admin"
    password: str = ""
    stop_on_exit: bool = False
    app_install: AppInstall | None = None

    @classmethod
    def from_dict(cls, raw: dict | None) -> "VMConfig":
        if not raw:
            return cls()
        config = cls(
            enabled=raw.get("enabled", False),
            name=raw.get("name", "autogenesis-vm"),
            image=raw.get("image", "ghcr.io/cirruslabs/macos-sequoia-xcode:latest"),
            managed=raw.get("managed", True),
            user=raw.get("user", "admin"),
            password=raw.get("password") or os.getenv("AUTOGENESIS_VM_PASSWORD", ""),
            stop_on_exit=raw.get("stop_on_exit", False),
            app_install=AppInstall.from_dict(raw.get("app_install")),
        )
        config.validate()
        return config

    def validate(self) -> None:
        if self.enabled and not self.password:
            raise ValueError(
                "MAC_VM password is required; set it in the local config or "
                "AUTOGENESIS_VM_PASSWORD"
            )
