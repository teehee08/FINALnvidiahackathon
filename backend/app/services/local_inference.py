"""Structured generation through the user's configured inference endpoint."""
from __future__ import annotations

import json

import httpx
from pydantic import BaseModel, ValidationError

from ..schemas import ResearchFindings, UsageInfo
from .claude import ClaudeError, _strip_markdown_fences


class LocalInferenceService:
    def __init__(self, base_url: str, model: str, api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.fake_mode = False

    def structured(self, *, task: str, system: str, user_content: str,
                   schema_model: type[BaseModel], tools=None, max_tokens: int = 16000):
        if not self.base_url or not self.model:
            raise ClaudeError("The local model connection needs AMELIA_LLM_BASE_URL and AMELIA_LLM_MODEL.")
        # Local inference has no Anthropic-hosted search tools. An empty research
        # result lets tailoring use the supplied job posting without invented sources.
        if task in ("research_standard", "research_deep") and schema_model is ResearchFindings:
            return ResearchFindings(), UsageInfo(input_tokens=0, output_tokens=0, cost_usd=0)
        schema = schema_model.model_json_schema()
        messages = [
            {"role": "system", "content": system + "\nReturn only a JSON object matching this schema. "
             "Use only supplied evidence; never invent personal facts.\n" + json.dumps(schema)},
            {"role": "user", "content": user_content},
        ]
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        total_input = total_output = 0
        for attempt in range(2):
            try:
                payload = {"model": self.model, "messages": messages, "temperature": 0.1,
                           "max_tokens": max_tokens, "stream": False,
                           "response_format": {"type": "json_object"}}
                if "qwen" in self.model.lower():
                    payload["chat_template_kwargs"] = {"enable_thinking": False}
                response = httpx.post(
                    self.base_url + "/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=httpx.Timeout(600, connect=10),
                )
                response.raise_for_status()
                body = response.json()
                text = body["choices"][0]["message"]["content"]
                if not isinstance(text, str) or not text.strip():
                    raise ValueError("the model returned no text")
                usage = body.get("usage") or {}
                total_input += usage.get("prompt_tokens", 0)
                total_output += usage.get("completion_tokens", 0)
            except httpx.HTTPStatusError as exc:
                raise ClaudeError(f"Local inference returned HTTP {exc.response.status_code}. "
                                  "Check the endpoint, model name, and its authentication settings.") from exc
            except httpx.RequestError as exc:
                raise ClaudeError("Could not reach the configured local model. Check that its server is running.") from exc
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                raise ClaudeError("The inference endpoint returned an invalid chat-completion response.") from exc
            try:
                result = schema_model.model_validate_json(_strip_markdown_fences(text))
                return result, UsageInfo(input_tokens=total_input, output_tokens=total_output, cost_usd=0)
            except ValidationError as exc:
                if attempt:
                    raise ClaudeError(f"Local model output did not match the required {schema_model.__name__} format.") from exc
                messages.extend([
                    {"role": "assistant", "content": text},
                    {"role": "user", "content": "Correct the JSON to satisfy the schema. Return only JSON. "
                     + str(exc)[:1500]},
                ])
        raise AssertionError("unreachable")
