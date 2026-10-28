# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""Cloud test provider registry and capability resolver.

This module lets a single ``appium_conf.json`` platform block target different
execution backends (local Appium, BrowserStack, TestMu AI / LambdaTest, and
future ones) without any provider-specific code paths in the
driver.

Design goals
------------
* **Non-disruptive**: a platform block *without* a ``provider`` key is passed
  through unchanged, so every existing BrowserStack / local configuration keeps
  working byte-for-byte.
* **Extensible**: adding a new cloud vendor means adding one ``ProviderSpec``
  entry to ``_PROVIDERS`` below - no changes to the driver or the resolver.
* **Secret-safe**: credentials are never required in the committed config. They
  are injected at resolve time from the config's ``credentials`` block or from
  environment variables, so ``providerOptions`` can be shared/committed safely.

Config shape (only when using a provider)
-----------------------------------------
```
"ios": {
    "provider": "lambdatest",          # or "browserstack", "local"
    "platformName": "iOS",
    "appium:automationName": "XCUITest",
    "deviceName": "iPhone 14",
    "platformVersion": "16",
    "providerOptions": {                # becomes the vendor block verbatim
        "app": "lt://APP_ID",           #   e.g. "lt:options" for lambdatest
        "isRealMobile": true,
        "build": "AutoGenesis",
        "w3c": true
    },
    "credentials": {                     # optional; env vars used if omitted
        "username": "...",
        "accessKey": "..."
    }
}
```

The resolver turns the above into flat W3C capabilities plus a ``server_url``,
which is exactly what :class:`DriverSessionManager` already consumes.
"""

import os
from dataclasses import dataclass, field
from typing import Optional

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # dotenv is optional
    pass

from utils.logger import get_mcp_logger

logger = get_mcp_logger()

# Keys that control resolution and must never be forwarded as raw capabilities.
_CONTROL_KEYS = ("provider", "providerOptions", "credentials")


@dataclass(frozen=True)
class ProviderSpec:
    """Describes how to talk to one execution backend.

    Attributes:
        name: Canonical provider id (lowercase).
        options_key: W3C vendor-extension key that holds the vendor block
            (e.g. ``"lt:options"``). ``None`` means "no vendor block" (local).
        default_hub_url: Remote Appium hub URL used when the config does not set
            ``server_url``. ``None`` for local.
        cred_user_key / cred_access_key: Field names for the username / access
            key *inside the vendor block* (vendors disagree: ``user`` vs
            ``userName`` vs ``username``).
        env_user / env_access: Environment variables consulted for credentials
            when the config does not provide them.
        aliases: Alternate names accepted in the ``provider`` field.
    """

    name: str
    options_key: Optional[str] = None
    default_hub_url: Optional[str] = None
    cred_user_key: Optional[str] = None
    cred_access_key: Optional[str] = None
    env_user: Optional[str] = None
    env_access: Optional[str] = None
    aliases: tuple = field(default_factory=tuple)


# ---------------------------------------------------------------------------
# Provider registry -- add a new backend by appending one entry here.
# ---------------------------------------------------------------------------
_PROVIDERS = {
    "local": ProviderSpec(
        name="local",
        options_key=None,
        default_hub_url="http://127.0.0.1:4723",
        aliases=("custom",),
    ),
    "browserstack": ProviderSpec(
        name="browserstack",
        options_key="bstack:options",
        default_hub_url="https://hub.browserstack.com/wd/hub",
        cred_user_key="userName",
        cred_access_key="accessKey",
        env_user="BROWSERSTACK_USERNAME",
        env_access="BROWSERSTACK_ACCESS_KEY",
        aliases=("bstack",),
    ),
    "lambdatest": ProviderSpec(
        name="lambdatest",
        options_key="lt:options",
        default_hub_url="https://mobile-hub.lambdatest.com/wd/hub",
        cred_user_key="user",
        cred_access_key="accessKey",
        env_user="LT_USERNAME",
        env_access="LT_ACCESS_KEY",
        aliases=("testmu", "testmu-ai", "testmuai", "lt"),
    ),
    # To add another cloud provider, append a ProviderSpec entry here with its
    # hub URL, vendor options key, credential field names, and credential env vars.
}

# Build an alias -> canonical lookup once.
_ALIAS_TO_NAME = {}
for _spec in _PROVIDERS.values():
    _ALIAS_TO_NAME[_spec.name] = _spec.name
    for _alias in _spec.aliases:
        _ALIAS_TO_NAME[_alias] = _spec.name


def get_provider_spec(provider: Optional[str]) -> Optional[ProviderSpec]:
    """Resolve a provider name/alias to its :class:`ProviderSpec`.

    Returns ``None`` for an unset provider (meaning: passthrough). Raises
    ``ValueError`` for a non-empty but unknown provider name.
    """
    if not provider:
        return None
    key = str(provider).strip().lower()
    if key in _ALIAS_TO_NAME:
        return _PROVIDERS[_ALIAS_TO_NAME[key]]
    known = sorted(set(_ALIAS_TO_NAME))
    raise ValueError(
        f"Unknown provider '{provider}'. Known providers/aliases: {', '.join(known)}"
    )


def _resolve_credentials(config: dict, spec: ProviderSpec):
    """Return (username, access_key) using config first, then environment.

    Precedence (highest first):
        1. providerOptions already containing the vendor cred keys
        2. config["credentials"] {"username", "accessKey"}
        3. environment variables (spec.env_user / spec.env_access)
    """
    vendor = config.get("providerOptions", {}) or {}
    creds = config.get("credentials", {}) or {}

    user = (
        vendor.get(spec.cred_user_key)
        or creds.get("username")
        or creds.get("user")
        or (os.getenv(spec.env_user) if spec.env_user else None)
    )
    access = (
        vendor.get(spec.cred_access_key)
        or creds.get("accessKey")
        or creds.get("access_key")
        or (os.getenv(spec.env_access) if spec.env_access else None)
    )
    return user, access


def resolve_capabilities(config: dict) -> dict:
    """Turn a platform config block into concrete W3C capabilities.

    * No ``provider`` key -> the config is returned unchanged (passthrough),
      preserving legacy BrowserStack/local behaviour exactly.
    * A known ``provider`` -> the vendor block (``providerOptions``) is placed
      under the provider's ``options_key`` with credentials injected, and
      ``server_url`` defaults to the provider hub when not set.

    The returned dict always carries ``server_url`` for the driver to connect to.
    """
    provider = config.get("provider")
    spec = get_provider_spec(provider)

    # Base capabilities: everything except our control keys.
    caps = {k: v for k, v in config.items() if k not in _CONTROL_KEYS}

    # Passthrough / local (no vendor block).
    if spec is None or spec.options_key is None:
        if spec and spec.default_hub_url:
            caps.setdefault("server_url", spec.default_hub_url)
        return caps

    # Cloud provider: assemble the vendor options block.
    vendor = dict(config.get("providerOptions", {}) or {})
    user, access = _resolve_credentials(config, spec)
    if user:
        vendor.setdefault(spec.cred_user_key, user)
    if access:
        vendor.setdefault(spec.cred_access_key, access)

    if not user or not access:
        logger.warning(
            "Provider '%s' is missing credentials. Set them in config "
            "'credentials' or env vars %s / %s.",
            spec.name, spec.env_user, spec.env_access,
        )

    caps[spec.options_key] = vendor
    caps.setdefault("server_url", spec.default_hub_url)
    logger.info(
        "Resolved capabilities for provider '%s' (hub=%s, options_key=%s)",
        spec.name, caps.get("server_url"), spec.options_key,
    )
    return caps


def resolve_server_url(config: dict) -> str:
    """Convenience: the server_url the driver should connect to for this config."""
    return resolve_capabilities(config).get("server_url")
