import os
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class DocAgent:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None

    def call_agent(
        self,
        message_history: List[Dict[str, Any]],
        provider: str = "openai",
        model_id: Optional[str] = None,
        model_params: Optional[Dict[str, Any]] = None
    ):
        provider = (provider or "openai").lower()
        if provider == "openai":
            return self._call_openai(message_history, model_id, model_params)
        raise ValueError("DocAgent only supports OpenAI models.")

    def _call_openai(
        self,
        message_history: List[Dict[str, Any]],
        model_id: Optional[str],
        model_params: Optional[Dict[str, Any]] = None
    ):
        if not self.client:
            raise ValueError("OPENAI_API_KEY is not configured.")
        params = model_params or {}
        temperature = params.get("temperature", 0.2)
        max_tokens = params.get("max_tokens", 2048)
        top_p = params.get("top_p", 1)
        presence_penalty = params.get("presence_penalty", 0)
        frequency_penalty = params.get("frequency_penalty", 0)
        response = self.client.chat.completions.create(
            model=model_id or "gpt-4o",
            messages=message_history,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty
        )
        msg = response.choices[0].message
        return (msg.content or "").strip()
