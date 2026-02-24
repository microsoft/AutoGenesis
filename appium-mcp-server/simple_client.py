# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

"""MCP HTTP client example using MCP SDK."""

import asyncio
import sys
import argparse
from typing import Any
from urllib.parse import urlparse

from mcp.client.session import ClientSession
from mcp.client.sse import sse_client


def print_items(name: str, result: Any) -> None:
    # print("RAW RESULT:", result)

    print("", f"Available {name}:", sep="\n")
    items = getattr(result, name)
    if items:
        for item in items:
            print(" *", item)
    else:
        print("No items available")


async def main(server_url='http://localhost:8000/sse', tool_name=None):
    # try:
        async with sse_client(server_url) as streams:
            async with ClientSession(streams[0], streams[1]) as session:
                await session.initialize()
                # await session.call_tool(name="list_desktop_files")
                # await session.list_tools()
                if tool_name:
                    result = await session.call_tool(name=tool_name,arguments={'caller': 'simple_client'})
                    print_items("content", result)
                else:
                    result = await session.call_tool(name="press_key", arguments={'caller': 'simple_client', 'key': 'shift+cmd+.', 'need_snapshot': 0})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MCP Client Tool")
    parser.add_argument('--tool', type=str, help='Name of the tool to call')
    args = parser.parse_args()
    asyncio.run(main(tool_name=args.tool))