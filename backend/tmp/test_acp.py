import asyncio
import os
import sys

# Hack to import acp since we don't have the source handy, let's load what's installed
sys.path.insert(0, '/Users/magic/Project/github/open-teams/backend')
from app.services.acp_client import TeamMemberClient

print('success')

