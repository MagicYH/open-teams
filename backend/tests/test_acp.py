import subprocess
import time
import socket
import pytest
import os

def is_port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            s.connect((host, port))
            return True
        except:
            return False

def test_opencode_acp_starts_server():
    # Choose a high port for testing
    test_port = 18888
    
    # Ensure port is not in use
    if is_port_open("127.0.0.1", test_port):
        pytest.fail(f"Port {test_port} is already in use")

    # Start opencode acp
    log_file = "/tmp/opencode_test.log"
    import os
    from app.core.config import settings
    
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
    cmd_parts = settings.acp_start_command.split()
    cmd_parts.extend(["--port", str(test_port), "--print-logs"])
    
    with open(log_file, "w") as f:
        process = subprocess.Popen(
            cmd_parts,
            stdin=subprocess.PIPE,
            stdout=f,
            stderr=f,
            text=True,
            cwd=cwd
        )

    try:
        # Wait for server to start
        max_retries = 30
        started = False
        for i in range(max_retries):
            if is_port_open("127.0.0.1", test_port):
                started = True
                break
            time.sleep(1)
            if process.poll() is not None:
                # Process exited prematurely
                break
        
        if not started:
            with open(log_file, "r") as f:
                logs = f.read()
            pytest.fail(f"ACP server failed to start on port {test_port}.\nLOGS:\n{logs}")
        
        print(f"\nACP server started successfully on port {test_port}")
        
    finally:
        # Cleanup
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

if __name__ == "__main__":
    # Allow running directly
    test_opencode_acp_starts_server()
