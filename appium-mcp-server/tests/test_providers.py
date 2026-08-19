# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""Unit tests for the cloud provider capability resolver (utils/providers.py)."""

import pytest

from utils.providers import (
    resolve_capabilities,
    resolve_server_url,
    get_provider_spec,
)


# --- Passthrough: legacy configs must be untouched ------------------------

def test_no_provider_is_passthrough():
    """A config without a 'provider' key is returned essentially unchanged."""
    cfg = {
        "platformName": "Android",
        "automationName": "UiAutomator2",
        "server_url": "http://hub.browserstack.com/wd/hub",
        "bstack:options": {"userName": "u", "accessKey": "k"},
        "appium:app": "bs://abc",
    }
    out = resolve_capabilities(cfg)
    assert out == cfg
    # a real copy, not the same object
    assert out is not cfg


def test_local_config_passthrough_preserves_server_url():
    cfg = {"platformName": "iOS", "server_url": "http://127.0.0.1:4725"}
    out = resolve_capabilities(cfg)
    assert out["server_url"] == "http://127.0.0.1:4725"
    assert "lt:options" not in out


# --- local provider -------------------------------------------------------

def test_local_provider_defaults_hub():
    cfg = {"provider": "local", "platformName": "iOS"}
    out = resolve_capabilities(cfg)
    assert out["server_url"] == "http://127.0.0.1:4723"
    assert "provider" not in out  # control key stripped


# --- lambdatest -----------------------------------------------------------

def test_lambdatest_env_credentials(monkeypatch):
    monkeypatch.setenv("LT_USERNAME", "env_user")
    monkeypatch.setenv("LT_ACCESS_KEY", "env_key")
    cfg = {
        "provider": "lambdatest",
        "platformName": "iOS",
        "deviceName": "iPhone 14",
        "platformVersion": "16",
        "providerOptions": {"isRealMobile": True, "build": "AutoGenesis", "app": "lt://APP"},
    }
    out = resolve_capabilities(cfg)
    assert out["server_url"] == "https://mobile-hub.lambdatest.com/wd/hub"
    lt = out["lt:options"]
    assert lt["user"] == "env_user"
    assert lt["accessKey"] == "env_key"
    assert lt["isRealMobile"] is True
    assert lt["app"] == "lt://APP"
    # standard caps stay top-level
    assert out["platformName"] == "iOS"
    assert out["deviceName"] == "iPhone 14"
    # control keys removed
    assert "provider" not in out and "providerOptions" not in out


def test_config_credentials_override_env(monkeypatch):
    monkeypatch.setenv("LT_USERNAME", "env_user")
    monkeypatch.setenv("LT_ACCESS_KEY", "env_key")
    cfg = {
        "provider": "lambdatest",
        "credentials": {"username": "cfg_user", "accessKey": "cfg_key"},
        "providerOptions": {},
    }
    lt = resolve_capabilities(cfg)["lt:options"]
    assert lt["user"] == "cfg_user"
    assert lt["accessKey"] == "cfg_key"


def test_provideroptions_creds_win_over_everything(monkeypatch):
    monkeypatch.setenv("LT_USERNAME", "env_user")
    monkeypatch.setenv("LT_ACCESS_KEY", "env_key")
    cfg = {
        "provider": "lambdatest",
        "credentials": {"username": "cfg_user", "accessKey": "cfg_key"},
        "providerOptions": {"user": "explicit", "accessKey": "explicit_key"},
    }
    lt = resolve_capabilities(cfg)["lt:options"]
    assert lt["user"] == "explicit"
    assert lt["accessKey"] == "explicit_key"


def test_lambdatest_aliases():
    for alias in ("testmu", "testmu-ai", "lt", "LambdaTest"):
        assert get_provider_spec(alias).name == "lambdatest"


def test_explicit_server_url_overrides_default_hub(monkeypatch):
    monkeypatch.setenv("LT_USERNAME", "u")
    monkeypatch.setenv("LT_ACCESS_KEY", "k")
    cfg = {
        "provider": "lambdatest",
        "server_url": "https://mobile-hub.eu-central-1.lambdatest.com/wd/hub",
        "providerOptions": {},
    }
    out = resolve_capabilities(cfg)
    assert out["server_url"] == "https://mobile-hub.eu-central-1.lambdatest.com/wd/hub"


# --- browserstack via the provider mechanism (opt-in) ---------------------

def test_browserstack_via_provider(monkeypatch):
    monkeypatch.setenv("BROWSERSTACK_USERNAME", "bs_user")
    monkeypatch.setenv("BROWSERSTACK_ACCESS_KEY", "bs_key")
    cfg = {
        "provider": "browserstack",
        "platformName": "Android",
        "providerOptions": {"projectName": "AutoGenesis", "buildName": "b1"},
        "appium:app": "bs://abc",
    }
    out = resolve_capabilities(cfg)
    assert out["server_url"] == "https://hub.browserstack.com/wd/hub"
    bs = out["bstack:options"]
    assert bs["userName"] == "bs_user"
    assert bs["accessKey"] == "bs_key"
    assert bs["projectName"] == "AutoGenesis"
    assert out["appium:app"] == "bs://abc"


# --- errors & helpers -----------------------------------------------------

def test_unknown_provider_raises():
    with pytest.raises(ValueError):
        resolve_capabilities({"provider": "nope"})


def test_resolve_server_url_helper(monkeypatch):
    monkeypatch.setenv("LT_USERNAME", "u")
    monkeypatch.setenv("LT_ACCESS_KEY", "k")
    assert resolve_server_url({"provider": "lambdatest"}) == "https://mobile-hub.lambdatest.com/wd/hub"


def test_missing_credentials_still_resolves(monkeypatch):
    monkeypatch.delenv("LT_USERNAME", raising=False)
    monkeypatch.delenv("LT_ACCESS_KEY", raising=False)
    out = resolve_capabilities({"provider": "lambdatest", "providerOptions": {}})
    # no creds available -> vendor block exists but without cred keys
    assert "lt:options" in out
    assert "user" not in out["lt:options"]
