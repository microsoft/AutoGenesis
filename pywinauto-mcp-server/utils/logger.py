# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.


import logging
import json
import os
import time
import uuid
from datetime import datetime

from functools import wraps
from dotenv import load_dotenv


load_dotenv()

log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
mcp_log_dir = os.getenv('MCP_LOG_FILE')
agent_index = os.getenv('AGENT_INDEX', '')
if mcp_log_dir:
    log_dir = mcp_log_dir
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f'mcp_server_{agent_index}_{datetime.now().strftime("%Y%m%d")}.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def log_tool_call(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        tool_name = func.__name__
        time_s = time.time()
        call_id = str(uuid.uuid4())

        logger.info(f"Tool Call - Start - ID: {call_id} - Tool: {tool_name} - Parameters: {json.dumps(kwargs, ensure_ascii=False)}")
        try:
            result = await func(*args, **kwargs)

            time_cost = time.time() - time_s
            if time_cost > 35:
                logger.warning(f"Warning: Tool {tool_name} took too long ({time_cost:.3f} seconds) to execute.")

            logger.info(f"Tool Call - Success - ID: {call_id} - Tool: {tool_name} - Time Cost: {time_cost:.3f} seconds - Parameters: {json.dumps(kwargs, ensure_ascii=False)}")
            
            if isinstance(result, (list, dict, str)) and len(str(result)) > 1000:
                logger.info(f"Result: (large output, showing summary) Type: {type(result)}, Size: {len(str(result))} chars")
            else:
                try:
                    logger.info(f"Result: {json.dumps(result, ensure_ascii=False)}")
                except TypeError:
                    logger.error(f"Result: [Unable to serialize: {type(result)}]")

            return result

        except Exception as e:
            import traceback
            traceback.print_exc()
            time_cost = time.time() - time_s
            if time_cost > 35:
                logger.warning(f"Warning: Tool {tool_name} took too long ({time_cost:.3f} seconds) to execute.")
            logger.error(f"Tool Call - Error - ID: {call_id} - Tool: {tool_name} - Time Cost: {time_cost:.3f} seconds - Parameters: {json.dumps(kwargs, ensure_ascii=False)} - Error: {str(e)}")
            raise

    return wrapper
