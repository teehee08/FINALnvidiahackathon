import json

import httpx
import pytest
from pydantic import BaseModel

from backend.app.config import Settings
from backend.app.schemas import ResearchFindings
from backend.app.services.claude import ClaudeError, make_claude
from backend.app.services.local_inference import LocalInferenceService


class Reply(BaseModel):
    text: str


def test_factory_uses_local_endpoint_without_anthropic_key(monkeypatch):
    settings = Settings(anthropic_api_key=None, fake_mode=False, inference_provider="local",
                        local_base_url="http://127.0.0.1:8000/v1", local_model="local-model")
    service = make_claude(settings)
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"text":"Ready"}'}}],
                                        "usage": {"prompt_tokens": 20, "completion_tokens": 5}})
    monkeypatch.setattr(httpx, "post", lambda url, **kwargs: _response(post, url, **kwargs))
    result, usage = service.structured(task="test", system="Use evidence", user_content="My resume", schema_model=Reply)
    assert result.text == "Ready"
    assert usage.input_tokens == 20
    assert calls[0][0] == "http://127.0.0.1:8000/v1/chat/completions"
    assert calls[0][1]["json"]["model"] == "local-model"
    assert calls[0][1]["headers"] == {}


def _response(fn, url, **kwargs):
    response = fn(url, **kwargs)
    response.request = httpx.Request("POST", url)
    return response


def test_local_validation_retries_and_preserves_schema(monkeypatch):
    replies = iter(['{"wrong":true}', '{"text":"Corrected"}'])
    sent = []
    def post(url, **kwargs):
        sent.append(json.loads(json.dumps(kwargs["json"])))
        return httpx.Response(200, request=httpx.Request("POST", url),
                              json={"choices": [{"message": {"content": next(replies)}}]})
    monkeypatch.setattr(httpx, "post", post)
    result, _ = LocalInferenceService("http://localhost:8000/v1", "model").structured(
        task="test", system="System", user_content="Input", schema_model=Reply)
    assert result.text == "Corrected"
    assert len(sent) == 2
    assert len(sent[1]["messages"]) == 4


def test_local_connection_failure_does_not_fall_back_to_cloud(monkeypatch):
    def fail(*args, **kwargs):
        raise httpx.ConnectError("offline")
    monkeypatch.setattr(httpx, "post", fail)
    with pytest.raises(ClaudeError, match="configured local model"):
        LocalInferenceService("http://localhost:8000/v1", "model").structured(
            task="test", system="System", user_content="Input", schema_model=Reply)


def test_local_research_does_not_invent_web_sources():
    result, _ = LocalInferenceService("http://localhost:8000/v1", "model").structured(
        task="research_standard", system="Research", user_content="Company",
        schema_model=ResearchFindings, tools=[{"name": "web_fetch"}])
    assert result.sources == []
    assert result.mission == ""
