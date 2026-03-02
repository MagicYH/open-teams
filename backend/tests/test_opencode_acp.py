import asyncio
import logging
import sys
from typing import Any
import acp
from acp.core import Client, ClientSideConnection
from acp.helpers import text_block

logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)

class MyClient(Client):
    def on_connect(self, connection):
        self.connection = connection
    
    async def session_update(self, session_id: str, update: Any, **kwargs):
        print(f"session_update: {update.session_update}")
        if hasattr(update, "content"):
            print(f"content: {update.content}")

async def test_acp():
    client = MyClient()
    print("Spawning agent process...")
    async with acp.spawn_agent_process(
        client,
        "opencode",
        "acp"
    ) as (connection, process):
        print("Agent spawned. Initializing connection...")
        
        async def observer(event):
            print(f"RAW {event.direction}: {event.message}")
        connection._conn.add_observer(observer)
        
        await connection.initialize(protocol_version=1)
        print("Initialized.")
        
        # We need a session
        print("Creating session...")
        session_resp = await connection.new_session(cwd="/tmp")
        session_id = session_resp.session_id
        print(f"Session created: {session_id}")
        
        print("Sending prompt...")
        prompt_resp = await connection.prompt(
            prompt=[text_block("Hello! Can you hear me?")],
            session_id=session_id
        )
        print(f"Prompt response: {prompt_resp}")

if __name__ == "__main__":
    asyncio.run(test_acp())
