"""Run real local generation and one refinement against an isolated temporary DB."""
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
os.environ["TAILORED_DATA_DIR"] = tempfile.mkdtemp(prefix="amelia-local-check-")
os.environ["TAILORED_FAKE"] = "0"

from backend.app.main import create_app

client = TestClient(create_app())
profile = client.post("/api/profiles", json={"name": "Local generation check"}).json()
resume = """Alex Chen
alex@example.com
Education: Example University, B.S. Computer Science, 2025
Experience: Example Labs, Product Intern, June 2024 to August 2024.
Interviewed 12 students about course planning. Wrote requirements for a planning
tool and coordinated with 3 engineers. Reduced onboarding steps from 6 to 4.
Skills: Python, SQL, user research, requirements writing.
"""
upload = client.post(f"/api/profiles/{profile['id']}/documents",
                     json={"filename": "check.txt", "text": resume})
upload.raise_for_status()
print("Building profile...", flush=True)
built = client.post(f"/api/profiles/{profile['id']}/build")
built.raise_for_status()
print("Profile built.", flush=True)
created = client.post("/api/applications/batch", json={
    "profile_id": profile["id"], "jobs": [{"url": "https://example.com/role"}],
    "default_depth": "quick", "default_template": "slate", "generate": False,
}).json()[0]
app_id = created["id"]
print("Generating resume...", flush=True)
client.post(f"/api/applications/{app_id}/paste", json={
    "text": "Example Company seeks a Junior Product Manager. Responsibilities: user research, requirements writing, collaborating with engineers. SQL and Python are useful."
}).raise_for_status()
result = client.get(f"/api/applications/{app_id}").json()
if result["status"] != "ready":
    raise RuntimeError(result.get("error_message") or result["status"])
pdf = client.get(f"/api/applications/{app_id}/exports/resume.pdf")
pdf.raise_for_status()
assert pdf.content.startswith(b"%PDF")
print("Resume PDF generated.", flush=True)
client.post(f"/api/applications/{app_id}/regenerate", json={
    "feedback": "Make the summary shorter and emphasize requirements writing. Keep all facts unchanged."
}).raise_for_status()
updated = client.get(f"/api/applications/{app_id}").json()
if updated["status"] != "ready":
    raise RuntimeError(updated.get("error_message") or updated["status"])
assert updated["version"] > result["version"]
print("Follow-up refinement completed. Output: " + os.environ["TAILORED_DATA_DIR"], flush=True)
