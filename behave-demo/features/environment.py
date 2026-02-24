# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

from asyncio.log import logger
import json
import os
import re
import time
import threading
import asyncio
import janus
import queue
import pathlib
from datetime import datetime
from mcp.client.session import ClientSession
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client, StdioServerParameters
from behave.contrib.scenario_autoretry import patch_scenario_with_autoretry


session_ready = threading.Event()
TRANSPORT = "sse"  # Default transport method, can be changed to "sse" if needed

# Global package variable - loaded from environment
package = os.environ.get('PACKAGE', 'com.microsoft.emmx.canary')
current_version = os.environ.get('SOURCE_BUILD_TITLE', '145.0.2254.0')

def load_mcp_config():
    current_dir = pathlib.Path(__file__).parent.parent
    mcp_config_path = current_dir / ".vscode" / "mcp.json"
    
    if not mcp_config_path.exists():
        raise FileNotFoundError(f"MCP config file not found: {mcp_config_path}")
    
    with open(mcp_config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # Find server configuration starting with bdd-auto-mcp
    servers = config.get("servers", {})
    for server_name, server_config in servers.items():
        if server_name.startswith("bdd-auto-mcp"):
            command = server_config.get("command")
            args = server_config.get("args", [])
            print(f"Found MCP server configuration: command={command}")
            print(f"Found MCP server configuration: args={args}")
            return command, args
    
    raise ValueError("No bdd-auto-mcp server configuration found in mcp.json")

def take_screenshot(context, scenario_name):
    """
    Take a full screen screenshot and save it with the scenario name
    Screenshot naming convention: *{test_name}*.png
    Storage location: SCREENSHOT_DIR environment variable
    """
    try:
        # Get screenshot directory from environment variable
        screenshot_dir = os.environ.get('SCREENSHOT_DIR')
        if not screenshot_dir:
            # Fallback to default location if env var not set
            current_dir = pathlib.Path(__file__).parent.parent
            screenshot_dir = current_dir / 'screenshots'
            logger.warning(
                f'SCREENSHOT_DIR environment variable not set, using default: {screenshot_dir}'
            )
        else:
            screenshot_dir = pathlib.Path(screenshot_dir)

        # Create screenshots directory if it doesn't exist
        screenshot_dir.mkdir(parents=True, exist_ok=True)

        # Get testcase name (scenario_name is the testcase name)
        name = scenario_name

        # Clean test name for use as filename - replace spaces with underscores
        # Screenshot naming convention: *{test_name}*.png
        test_name_pattern = clean_test_name(name)

        # Add timestamp to avoid filename conflicts while following the pattern
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'{test_name_pattern}_{timestamp}.png'

        # Full path for the screenshot
        screenshot_path = screenshot_dir / filename

        result = call_tool_sync(context, context.session.call_tool(name="take_screenshot", arguments={"save_path": str(screenshot_path)}))
        status = get_tool_json(result).get('status')
        if status == "success":
            logger.info(f'Screenshot saved: {screenshot_path}')
            return str(screenshot_path)
        else:
            logger.error(f'Screenshot failed: {get_tool_json(result)}')
            return None

    except Exception as e:
        logger.error(f'Error taking screenshot: {str(e)}')
        return None

def clean_test_name(name):
    """
    Clean test case name by removing/replacing special characters

    Args:
        name: Original test case name

    Returns:
        str: Cleaned name suitable for file pattern matching
    """
    if not name:
        return ''

    # Replace common problematic characters with underscore
    # Keep only alphanumeric, underscore, hyphen, and space
    cleaned = re.sub(r'[^\w\s\-]', '_', name)

    # Replace multiple spaces with single space, then replace spaces with underscore
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = cleaned.replace(' ', '_')

    # Replace multiple underscores with single underscore
    cleaned = re.sub(r'_+', '_', cleaned)

    # Remove leading and trailing underscores
    cleaned = cleaned.strip('_')

    return cleaned

def before_all(context):
    import threading

    # Print package information for debugging
    global package
    if package:
        print(f"Package loaded from environment: {package}")
    else:
        print("Warning: 'package' environment variable not set")
    
    context._task_queue = janus.Queue()
    context._result_queue = janus.Queue()
    session_ready = threading.Event()

    def run_loop():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def mcp_worker():
            try:
                if TRANSPORT == "stdio":
                    print("Using stdio transport for MCP server")
                    # Load configuration from mcp.json
                    command, args = load_mcp_config()
                    print(f"Loading MCP server with command: {command}")
                    print(f"Args: {args}")
                    
                    # Define MCP server parameters
                    server_params = StdioServerParameters(
                        command=command,
                        args=args
                    )
                    
                    # Connect to server using stdio_client
                    async with stdio_client(server_params) as streams:
                        async with ClientSession(*streams) as session:
                            await session.initialize()
                            context.session = session
                            session_ready.set()

                            while True:
                                task = await context._task_queue.async_q.get()
                                if task is None:
                                    break

                                coro = task
                                result = await coro
                                await context._result_queue.async_q.put(result)
                else:
                    print("Using SSE transport for MCP server")
                    # Connect to server using sse_client
                    print("Connecting to SSE server at http://localhost:8000/sse")
                    async with sse_client("http://localhost:8000/sse") as streams:
                        async with ClientSession(*streams) as session:
                            await session.initialize()
                            context.session = session
                            session_ready.set()

                            while True:
                                task = await context._task_queue.async_q.get()
                                if task is None:
                                    break

                                start = time.time()
                                coro = task
                                result = await coro
                                await context._result_queue.async_q.put(result)

            except Exception as e:
                print(f"MCP init failed: {repr(e)}")
                session_ready.set()

        loop.run_until_complete(mcp_worker())

    thread = threading.Thread(target=run_loop, daemon=True)
    thread.start()

    session_ready.wait()




def after_all(context):
   pass

def call_tool_sync(context, coro, timeout=400):
    start = time.time()
    context._task_queue.sync_q.put(coro)
    while True:
        try:
            result = context._result_queue.sync_q.get_nowait()
            return result
        except queue.Empty:
            if time.time() - start > timeout:
                raise TimeoutError("MCP tool invocation timed out.")
            time.sleep(0.1)


def get_tool_json(result):
    try:
        if isinstance(result, str):
            return result
        items = getattr(result, "content", None)
        if items:
            for item in items:
                if getattr(item, "text", None):
                    text = getattr(item, "text", None)
                    return json.loads(text)
    except Exception as e:
        print(f"Error getting tool JSON: {e}")
        
    return None


def before_scenario(context, scenario):
    context.scenario = scenario
    if 'wip' in scenario.tags:
        print(f"Skipping scenario '{scenario.name}' because it is marked as WIP.")
        scenario.skip("Scenario is marked as WIP")
        return
    
    if 'fre' in scenario.tags:
        print(f"Skipping fre scenario '{scenario.name}' because it is marked as FRE.")
        return
    pass

def after_scenario(context, scenario):
    take_screenshot(context, scenario.name)


def before_feature(context, feature):
    for scenario in feature.scenarios:
        patch_scenario_with_autoretry(scenario, max_attempts=2)
