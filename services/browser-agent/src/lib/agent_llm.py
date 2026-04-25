"""LLM selection for browser-agent's `mode: agent` runs.

Selects between Qwen (Alibaba DashScope) and Anthropic Claude based on which
API key is configured. Qwen takes precedence so the multi-cloud demo runs
through Alibaba's vision model. Falls back to Anthropic for dev.

Both options support vision (`use_vision=True`), required by browser-use.
"""

from __future__ import annotations

import os
from typing import Any


class AgentLLMUnavailable(RuntimeError):
    """Neither DASHSCOPE_API_KEY nor ANTHROPIC_API_KEY is set."""


def select_agent_llm() -> Any:
    """Return a langchain ChatModel for the browser-use Agent.

    Order: Qwen (DashScope) → Anthropic Claude. First match wins.
    """
    if os.environ.get("DASHSCOPE_API_KEY"):
        # OpenAI-compatible endpoint. qwen-vl-max is the vision-language model.
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=os.environ.get("QWEN_MODEL", "qwen-vl-max"),
            api_key=os.environ["DASHSCOPE_API_KEY"],
            base_url=os.environ.get(
                "DASHSCOPE_BASE_URL",
                "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            ),
            temperature=0,
            max_tokens=4096,
        )

    if os.environ.get("ANTHROPIC_API_KEY"):
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=os.environ.get("BROWSER_AGENT_ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            temperature=0,
            max_tokens=4096,
        )

    raise AgentLLMUnavailable(
        "Agent mode needs DASHSCOPE_API_KEY (preferred) or ANTHROPIC_API_KEY"
    )


def selected_provider_name() -> str:
    """Human-readable name of the LLM that select_agent_llm() will pick."""
    if os.environ.get("DASHSCOPE_API_KEY"):
        return f"qwen ({os.environ.get('QWEN_MODEL', 'qwen-vl-max')})"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return f"anthropic ({os.environ.get('BROWSER_AGENT_ANTHROPIC_MODEL', 'claude-sonnet-4-6')})"
    return "none"
