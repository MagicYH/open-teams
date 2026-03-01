import os
from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
from typing import List, Dict

router = APIRouter(prefix="/api/utils", tags=["utils"])

@router.get("/list-directories")
def list_directories(path: str = Query("/", description="The path to list directories from")):
    try:
        target_path = Path(path).expanduser().resolve()
        if not target_path.exists():
            # If path doesn't exist, try to start from user home or root
            target_path = Path.home()
        
        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")

        items = []
        # Add parent directory if not at root
        if target_path != target_path.parent:
            items.append({
                "name": "..",
                "path": str(target_path.parent),
                "is_dir": True
            })

        try:
            for entry in os.scandir(target_path):
                if entry.is_dir() and not entry.name.startswith('.'):
                    items.append({
                        "name": entry.name,
                        "path": str(Path(entry.path)),
                        "is_dir": True
                    })
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

        return {
            "current_path": str(target_path),
            "items": sorted(items, key=lambda x: x["name"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-directory")
def create_directory(path: str, name: str):
    try:
        base_path = Path(path).expanduser().resolve()
        new_dir = base_path / name
        
        if new_dir.exists():
            raise HTTPException(status_code=400, detail="Directory already exists")
            
        new_dir.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "path": str(new_dir)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
