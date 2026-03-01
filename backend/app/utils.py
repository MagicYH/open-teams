from fastapi import Request

def get_log_id(request: Request) -> str:
    return getattr(request.state, "log_id", "unknown")
