# tools/config_tool.py

from utils.logger import get_mcp_logger

logger = get_mcp_logger()


def register_config_tools(mcp, config_manager):
    """Register configuration management tools"""

    @mcp.tool()
    def reload_config() -> dict:
        """
        Manually reload the configuration from file.

        This tool forces an immediate reload of the appium configuration file.
        Useful when you want to apply configuration changes immediately without
        waiting for the automatic file watcher to detect changes.

        Returns:
            dict: Status of the reload operation with configuration details
        """
        try:
            logger.info("Manual config reload requested")
            success = config_manager.reload_config()

            if success:
                current_config = config_manager.get_config()
                platforms = list(current_config.keys())

                return {
                    "success": True,
                    "message": "Configuration reloaded successfully",
                    "platforms": platforms,
                    "config_path": config_manager.config_path
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to reload configuration. Check server logs for details.",
                    "config_path": config_manager.config_path
                }

        except Exception as e:
            error_msg = f"Error reloading configuration: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg,
                "config_path": config_manager.config_path
            }

    @mcp.tool()
    def get_current_config(platform: str = None) -> dict:
        """
        Get the current configuration.

        Args:
            platform: Optional platform name (ios/android/mac). If not specified, returns all configs.

        Returns:
            dict: Current configuration for the specified platform or all platforms
        """
        try:
            if platform:
                config = config_manager.get_platform_config(platform)
                if config is None:
                    return {
                        "success": False,
                        "message": f"Platform '{platform}' not found in configuration"
                    }
                return {
                    "success": True,
                    "platform": platform,
                    "config": config
                }
            else:
                config = config_manager.get_config()
                return {
                    "success": True,
                    "platforms": list(config.keys()),
                    "config": config
                }

        except Exception as e:
            error_msg = f"Error getting configuration: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg
            }
