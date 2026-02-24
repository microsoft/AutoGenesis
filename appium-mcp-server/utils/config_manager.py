# utils/config_manager.py

import json
import os
import logging
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from utils.logger import get_mcp_logger

logger = get_mcp_logger()


class ConfigFileHandler(FileSystemEventHandler):
    """Handler for configuration file changes"""

    def __init__(self, config_manager):
        self.config_manager = config_manager

    def on_modified(self, event):
        if event.is_directory:
            return

        # Check if the modified file is our config file
        if Path(event.src_path).resolve() == Path(self.config_manager.config_path).resolve():
            logger.info(f"Configuration file changed: {event.src_path}")
            self.config_manager.reload_config()


class ConfigManager:
    """Manages configuration loading and hot-reloading"""

    def __init__(self, config_path=None, on_config_change=None):
        """
        Initialize the config manager

        Args:
            config_path: Path to the configuration file
            on_config_change: Optional callback function when config changes
        """
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "conf/appium_conf.json"
            )

        self.config_path = os.path.abspath(config_path)
        self.on_config_change = on_config_change
        self._config = None
        self._lock = threading.Lock()
        self._observer = None

        # Load initial configuration
        self.reload_config()

    def start_watching(self):
        """Start watching the configuration file for changes"""
        if self._observer is not None:
            logger.warning("Config file watcher is already running")
            return

        try:
            # Watch the directory containing the config file
            config_dir = os.path.dirname(self.config_path)
            event_handler = ConfigFileHandler(self)
            self._observer = Observer()
            self._observer.schedule(event_handler, config_dir, recursive=False)
            self._observer.start()
            logger.info(f"Started watching config file: {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to start config file watcher: {e}")
            self._observer = None

    def stop_watching(self):
        """Stop watching the configuration file"""
        if self._observer is not None:
            self._observer.stop()
            self._observer.join()
            self._observer = None
            logger.info("Stopped watching config file")

    def reload_config(self):
        """Reload configuration from file"""
        try:
            with self._lock:
                logger.info(f"Loading configuration from: {self.config_path}")

                if not os.path.exists(self.config_path):
                    raise FileNotFoundError(f"Configuration file not found: {self.config_path}")

                with open(self.config_path, 'r') as f:
                    config_data = json.load(f)

                appium_driver_configs = config_data.get("APPIUM_DRIVER_CONFIGS", {})

                if not appium_driver_configs:
                    logger.warning("No APPIUM_DRIVER_CONFIGS found in configuration file")

                self._config = appium_driver_configs
                logger.info(f"Configuration loaded successfully. Platforms: {list(appium_driver_configs.keys())}")

                # Notify callback if registered
                if self.on_config_change:
                    try:
                        self.on_config_change(self._config)
                    except Exception as e:
                        logger.error(f"Error in config change callback: {e}")

                return True

        except Exception as e:
            logger.error(f"Failed to reload configuration: {e}")
            return False

    def get_config(self):
        """Get the current configuration"""
        with self._lock:
            return self._config.copy() if self._config else {}

    def get_platform_config(self, platform):
        """Get configuration for a specific platform"""
        with self._lock:
            if self._config is None:
                return None
            return self._config.get(platform)

    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop_watching()
