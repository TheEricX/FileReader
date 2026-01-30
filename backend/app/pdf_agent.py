import os
import json
from typing import List, Dict, Any, Optional
import boto3
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class PdfAgent:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        self.aws_region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
        self.bedrock_runtime = boto3.client("bedrock-runtime", region_name=self.aws_region)

    def call_agent(
        self,
        message_history: List[Dict[str, Any]],
        provider: str = "openai",
        model_id: Optional[str] = None,
        model_params: Optional[Dict[str, Any]] = None
    ):
        provider = (provider or "openai").lower()
        if provider == "bedrock":
            return self._call_bedrock(message_history, model_id, model_params)
        return self._call_openai(message_history, model_id, model_params)

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

    def _build_bedrock_messages(self, message_history: List[Dict[str, Any]]):
        system_messages = []
        messages = []
        for msg in message_history:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_messages.append(content)
                continue
            messages.append({
                "role": role,
                "content": [{"type": "text", "text": content}]
            })
        system = "\n\n".join(system_messages) if system_messages else None
        return system, messages

    def _call_bedrock(
        self,
        message_history: List[Dict[str, Any]],
        model_id: Optional[str],
        model_params: Optional[Dict[str, Any]] = None
    ):
        system, messages = self._build_bedrock_messages(message_history)
        model_id = model_id or os.getenv("BEDROCK_MODEL_ID", "")
        if not model_id:
            raise ValueError("Bedrock model_id is required.")
        params = model_params or {}
        temperature = params.get("temperature", 0.2)
        max_tokens = params.get("max_tokens", 2048)
        top_p = params.get("top_p", 1)

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p
        }
        if system:
            body["system"] = system

        response = self.bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps(body)
        )
        response_body = json.loads(response["body"].read())
        content = response_body.get("content", [])
        text_parts = [block.get("text", "") for block in content if block.get("type") == "text"]
        return "\n".join(part for part in text_parts if part).strip()
