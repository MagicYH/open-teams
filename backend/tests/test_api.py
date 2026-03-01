import pytest
from httpx import AsyncClient, ASGITransport
import asyncio

from app.main import app
from app.models.database import Base
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# In project.py, get_db is defined, but we can override it in app
from app.routers.project import get_db as project_get_db

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[project_get_db] = override_get_db

from app.models.project import Project
from app.models.feature import Feature
from app.models.team import Team, TeamMember
from app.models.message import Message
from app.models.work_log import WorkLog

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="module")
def client():
    # Use httpx.AsyncClient with ASGITransport for testing FastAPI async
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

@pytest.mark.asyncio
async def test_get_projects_empty(client):
    response = await client.get("/api/projects/")
    assert response.status_code == 200
    assert response.json() == []

@pytest.mark.asyncio
async def test_create_project(client):
    response = await client.post("/api/projects/", json={"name": "Test Project", "directory": "/tmp/test"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["directory"] == "/tmp/test"
    assert "id" in data

@pytest.mark.asyncio
async def test_get_projects_after_create(client):
    response = await client.get("/api/projects/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(p["name"] == "Test Project" for p in data)
