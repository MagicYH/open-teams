import httpx
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_isolation():
    with httpx.Client(base_url=BASE_URL, follow_redirects=True) as client:
        # Create Project A
        print("Creating Project A...")
        p_a = client.post("/api/projects", json={"name": "Project A", "directory": "/tmp/proj_a"}).json()
        pa_id = p_a["id"]
        
        # Create Feature A1
        print("Creating Feature A1...")
        f_a1 = client.post(f"/api/projects/{pa_id}/features", json={"name": "Feature A1"}).json()
        fa1_id = f_a1["id"]
        
        # Create Feature A2
        print("Creating Feature A2...")
        f_a2 = client.post(f"/api/projects/{pa_id}/features", json={"name": "Feature A2"}).json()
        fa2_id = f_a2["id"]
        
        # Send message to Feature A1 mentioning PM
        print("Sending message to A1 mentioning @PM...")
        client.post(f"/api/features/{fa1_id}/messages", json={
            "feature_id": fa1_id,
            "sender": "@User",
            "content": "@PM Secret A1",
            "mentions": ["@PM"]
        }).raise_for_status()

        # Wait a few seconds for PM to reply
        print("Waiting for PM to reply...")
        time.sleep(15)

        # Get messages to verify isolation and agent's reply
        m_a1 = client.get(f"/api/features/{fa1_id}/messages").json()
        print(f"Feature A1 messages: {[m['content'] for m in m_a1]}")
        
        # Check A2 messages
        m_a2 = client.get(f"/api/features/{fa2_id}/messages").json()
        print(f"Feature A2 messages (should be empty): {[m['content'] for m in m_a2]}")
        
        if any("Secret A1" in m["content"] for m in m_a2):
            print("FAILURE: Feature A2 leaked A1 message!")
        else:
            print("SUCCESS: Feature A2 is isolated.")

        # Create Project B
        print("\nCreating Project B...")
        p_b = client.post("/api/projects", json={"name": "Project B", "directory": "/tmp/proj_b"}).json()
        pb_id = p_b["id"]
        
        # Create Feature B1
        print("Creating Feature B1...")
        f_b1 = client.post(f"/api/projects/{pb_id}/features", json={"name": "Feature B1"}).json()
        fb1_id = f_b1["id"]
        
        # Check B1 messages
        m_b1 = client.get(f"/api/features/{fb1_id}/messages").json()
        print(f"Feature B1 messages (should be empty): {[m['content'] for m in m_b1]}")
        
        if any("Secret A1" in m["content"] for m in m_b1):
            print("FAILURE: Feature B1 leaked A1 message!")
        else:
            print("SUCCESS: Feature B1 is isolated.")

if __name__ == "__main__":
    test_isolation()
