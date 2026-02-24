# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.


import logging
import json
import os
import uuid
from datetime import datetime
from functools import wraps


def get_mcp_logger(name=None):
    """
    Get a logger configured for MCP server components
    
    Args:
        name: Logger name, defaults to caller's module name
        
    Returns:
        logging.Logger: Configured logger instance
    """
    if name is None:
        # Get caller's module name
        import inspect
        frame = inspect.currentframe().f_back
        name = frame.f_globals.get('__name__', 'mcp_component')
    
    component_logger = logging.getLogger(name)
    
    # Avoid duplicate handlers if logger already configured
    if component_logger.handlers:
        return component_logger
    
    # Set log level
    mcp_log_level = os.environ.get('MCP_LOG_LEVEL', 'INFO').upper()
    log_level = getattr(logging, mcp_log_level, logging.INFO)
    component_logger.setLevel(log_level)
    
    # Check if MCP_LOG_FILE is set (pipeline environment)
    mcp_log_dir = os.environ.get('MCP_LOG_FILE')
    if mcp_log_dir:
        # Pipeline environment: only log to file, not console
        # MCP_LOG_FILE is the directory, log file is mcp_server.log inside it
        os.makedirs(mcp_log_dir, exist_ok=True)
        mcp_log_file = os.path.join(mcp_log_dir, 'mcp_server.log')
        
        # Add file handler only
        file_handler = logging.FileHandler(mcp_log_file, encoding='utf-8')
        file_handler.setLevel(log_level)
        file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(file_formatter)
        component_logger.addHandler(file_handler)
        
        # Prevent propagation to root logger (this prevents console output)
        component_logger.propagate = False
    else:
        # Local development: use original simple logging setup
        if name == 'mcp_server' and not getattr(logging.getLogger(), '_basicConfig_called', False):
            # Only set up basicConfig once for the main logger
            log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, f'mcp_server_{datetime.now().strftime("%Y%m%d")}.log')
            
            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                handlers=[
                    logging.FileHandler(log_file, encoding='utf-8'),
                    logging.StreamHandler()
                ]
            )
            logging.getLogger()._basicConfig_called = True
    
    return component_logger


# Initialize the main MCP server logger
logger = get_mcp_logger('mcp_server')

# logger = logging.getLogger(__name__)

def log_tool_call(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        tool_name = func.__name__
        call_id = str(uuid.uuid4())

        # 记录调用开始
        logger.info(f"Tool Call - Start - ID: {call_id} - Tool: {tool_name} - Parameters: {json.dumps(kwargs, ensure_ascii=False)}")
        try:
            # 执行原始异步函数，确保是 await
            result = await func(*args, **kwargs)
            
            # 如果 result 是字符串，尝试解析为 JSON
            if isinstance(result, str):
                try:
                    result = json.loads(result)
                except (json.JSONDecodeError, ValueError):
                    # 如果不是有效的 JSON，保持原样
                    pass

            # 检查是否是错误结果
            is_error_result = False
            if isinstance(result, dict) and result.get('status') == 'error':
                is_error_result = True
                logger.error(f"Tool Call - Error Result - ID: {call_id} - Tool: {tool_name} - Parameters: {json.dumps(kwargs, ensure_ascii=False)}")
            else:
                logger.info(f"Tool Call - Success - ID: {call_id} - Tool: {tool_name} - Parameters: {json.dumps(kwargs, ensure_ascii=False)}")

            # 处理大结果和错误结果
            result_str = str(result)
            result_size = len(result_str)
            
            if result_size > 1000 and (is_error_result or isinstance(result, (list, dict, str))):
                # 如果是错误结果且过大，或者普通结果过大，保存到文件
                mcp_log_dir = os.environ.get('MCP_LOG_FILE')
                if mcp_log_dir and is_error_result:
                    # 为错误结果创建单独的文件
                    # MCP_LOG_FILE is the directory, create error files inside it
                    os.makedirs(mcp_log_dir, exist_ok=True)
                    
                    # 创建错误结果文件名
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    error_file = os.path.join(mcp_log_dir, f"error_result_{tool_name}_{call_id}_{timestamp}.json")
                    
                    try:
                        with open(error_file, 'w', encoding='utf-8') as f:
                            json.dump({
                                'call_id': call_id,
                                'tool_name': tool_name,
                                'parameters': kwargs,
                                'timestamp': timestamp,
                                'result': result
                            }, f, ensure_ascii=False, indent=2)
                        
                        logger.error(f"Error Result: (large error result saved to file) File: {error_file}, Size: {result_size} chars")
                    except Exception as save_error:
                        logger.error(f"Failed to save error result to file: {save_error}")
                        logger.error(f"Error Result: (failed to save, showing summary) Type: {type(result)}, Size: {result_size} chars")
                else:
                    # 普通大结果，只记录摘要
                    logger.info(f"Result: (large output, showing summary) Type: {type(result)}, Size: {result_size} chars")
            else:
                # 结果不大，直接记录
                try:
                    logger.info(f"Result: {json.dumps(result, ensure_ascii=False)}")
                except TypeError:
                    logger.error(f"Result: [Unable to serialize: {type(result)}]")

            return result

        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Tool Call - Error - ID: {call_id} - Tool: {tool_name} - Parameters: {json.dumps(kwargs, ensure_ascii=False)} - Error: {str(e)}")
            raise

    return wrapper
