import json
import os
import re
import logging
import sys
import time
import uuid
from pathlib import Path
from utils.logger import log_tool_call
from utils.gen_code import HEADER_AUTO_GEN, STEPS_DIR_DEFAULT, TARGET_STEP_FILE_DEFAULT
from utils.gen_code import gen_code_preview, ensure_step_path_exists, gen_step_file_from_feature_path, parse_steps_dir_from_step_path
from utils.response_format import format_tool_response, init_tool_response
from utils.logger import get_mcp_logger


logger = get_mcp_logger()


def register_gen_code_tools(mcp, browser_manager):
    """Register generage code tools to MCP server."""    
    
    @mcp.tool()
    @log_tool_call
    async def before_gen_code(feature_file: str = '', step_file: str = '') -> str:
        """
        Clear cache and initialize code generation session before executing test case steps.
        
        This function should only be called before the first step of a test case execution.
        It clears any existing code generation cache and sets up a new generation session
        with a unique ID.
        
        Args:
            feature_file (str, optional): Full absolute path to the .feature file containing BDD scenarios.
                If not specified, do not provide a random value.
            step_file (str, optional): Full absolute path to the Python step definition file (.py).
                If not specified, do not provide a random value.
                
        Returns:
            str: JSON response containing:
                - status: "success" or "error"
                - data: Dictionary with gen_code_id, steps_dir, and step_file_target
                - error: Error message if operation failed
         
        """
        try:
            resp = init_tool_response()
            browser_manager.clear_gen_code_cache()
            browser_manager.gen_code_id = str(uuid.uuid4())
            logger.info(f"[GEN CODE START]:{browser_manager.gen_code_id}")
        
            if step_file and step_file.endswith('.py'):
                browser_manager.steps_dir = parse_steps_dir_from_step_path(step_file)
                browser_manager.step_file_target = step_file
            elif feature_file:
                browser_manager.steps_dir, browser_manager.step_file_target = gen_step_file_from_feature_path(feature_file)
            else:
                browser_manager.steps_dir = STEPS_DIR_DEFAULT
                browser_manager.step_file_target = TARGET_STEP_FILE_DEFAULT

            resp["status"] = "success"
            resp["data"] = {
                "gen_code_id": browser_manager.gen_code_id,
                "steps_dir": browser_manager.steps_dir,
                "step_file_target": browser_manager.step_file_target,
                # "gen_code_cache": browser_manager.gen_code_cache,
            }
        except Exception as e:
            resp["error"] = f"Error during code generation: {repr(e)}"
            logger.error(f"Error during code generation: {repr(e)}")
            raise e

        return json.dumps(format_tool_response(resp))
    
    @mcp.tool()
    @log_tool_call
    async def preview_code_changes() -> str:
        """Preview generated test code changes and confirm before applying"""
        resp = init_tool_response()
        
        if not browser_manager.gen_code_id or not browser_manager.gen_code_cache:
            resp["status"] = "success"
            resp["data"] = {"message": "No pending code changes to preview"}
            return json.dumps(format_tool_response(resp))
        
        result = gen_code_preview(browser_manager)
        resp["status"] = "success"
        resp["data"] = {"diff_preview": result.get('diff_preview')}
        
        return json.dumps(format_tool_response(resp))

    @mcp.tool()
    @log_tool_call
    async def confirm_code_changes() -> str:
        """Confirm the previewed code changes"""
        resp = init_tool_response()
        
        if not hasattr(browser_manager, 'proposed_changes') or not browser_manager.proposed_changes:
            resp["status"] = "success"
            resp["data"] = {"message": "No pending code changes to confirm"}
            return json.dumps(format_tool_response(resp))
        
        if not ensure_step_path_exists(browser_manager.step_file_target):
            resp["status"] = "error"
            resp["error"] = f"Failed to create directory structure for {browser_manager.step_file_target}"
            return json.dumps(format_tool_response(resp))
        
        try:
            with open(browser_manager.step_file_target, 'a', encoding='utf-8') as f:
                if hasattr(browser_manager, 'header_code') and browser_manager.header_code:
                    f.write(browser_manager.header_code + "\n")
                for item in browser_manager.proposed_changes:
                    f.write(item + "\n")
            
            result = f"Applied {len(browser_manager.proposed_changes)} new steps to {browser_manager.step_file_target}"
            browser_manager.new_steps_count = len(browser_manager.proposed_changes)
            resp["status"] = "success"
            resp["data"] = {"message": result, "new_steps_count": browser_manager.new_steps_count}
        except Exception as e:
            result = f"Error applying changes to {browser_manager.step_file_target}: {str(e)}"
            logger.error(result)
            resp["status"] = "error"
            resp["error"] = result
        
        # Clear the proposed changes
        browser_manager.clear_gen_code_cache()
        return json.dumps(format_tool_response(resp))


