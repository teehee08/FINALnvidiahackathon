from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_vault_preserves_original_across_app_restart(client, engine, fake_settings):
    content = b"Product manager\nBuild useful tools."
    response = client.post("/api/vault", files={"file": ("role.txt", content, "text/plain")},
                           data={"category": "Job description"})
    assert response.status_code == 200
    document = response.json()
    assert document["text"] == content.decode()
    restarted = TestClient(create_app(settings=fake_settings, engine=engine))
    assert restarted.get("/api/vault").json()[0]["id"] == document["id"]
    download = restarted.get(f"/api/vault/{document['id']}/download")
    assert download.content == content
    assert "role.txt" in download.headers["content-disposition"]


def test_vault_includes_legacy_text_without_duplicate_resume(client):
    profile = client.post("/api/profiles", json={"name": "Maya"}).json()
    client.post(f"/api/profiles/{profile['id']}/documents",
                json={"filename": "resume.txt", "text": "My experience"})
    legacy = client.get("/api/vault").json()[0]
    assert not legacy["original_available"]
    assert client.get(f"/api/vault/{legacy['id']}/download").text == "My experience"
    client.post("/api/vault", files={"file": ("resume.txt", b"My experience", "text/plain")},
                data={"category": "Resume"})
    documents = client.get("/api/vault").json()
    assert len(documents) == 1
    assert documents[0]["original_available"]


def test_vault_rejects_invalid_uploads_and_missing_downloads(client):
    assert client.post("/api/vault", data={"category": "Resume"}).status_code == 422
    assert client.get("/api/vault/file-999/download").status_code == 404
    assert client.get("/api/vault/unknown-1/download").status_code == 404


def test_remove_original_also_removes_legacy_copy(client):
    profile = client.post("/api/profiles", json={"name": "Maya"}).json()
    client.post(f"/api/profiles/{profile['id']}/documents",
                json={"filename": "resume.txt", "text": "My experience"})
    saved = client.post("/api/vault", files={"file": ("resume.txt", b"My experience", "text/plain")},
                        data={"category": "Resume"}).json()
    assert client.delete(f"/api/vault/{saved['id']}").status_code == 200
    assert client.get("/api/vault").json() == []
    assert client.get(f"/api/vault/{saved['id']}/download").status_code == 404


def test_remove_legacy_document_and_missing_id(client):
    profile = client.post("/api/profiles", json={"name": "Maya"}).json()
    client.post(f"/api/profiles/{profile['id']}/documents",
                json={"filename": "legacy.txt", "text": "A legacy source"})
    doc = client.get("/api/vault").json()[0]
    assert client.delete(f"/api/vault/{doc['id']}").status_code == 200
    assert client.get("/api/vault").json() == []
    assert client.delete(f"/api/vault/{doc['id']}").status_code == 404
