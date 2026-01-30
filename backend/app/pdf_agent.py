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
        model_id: Optional[str] = None
    ):
        provider = (provider or "openai").lower()
        if provider == "bedrock":
            return self._call_bedrock(message_history, model_id)
        return self._call_openai(message_history, model_id)

    def _call_openai(self, message_history: List[Dict[str, Any]], model_id: Optional[str]):
        if not self.client:
            raise ValueError("OPENAI_API_KEY is not configured.")
        response = self.client.chat.completions.create(
            model=model_id or "gpt-4o",
            messages=message_history,
            max_tokens=2048
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

    def _call_bedrock(self, message_history: List[Dict[str, Any]], model_id: Optional[str]):
        system, messages = self._build_bedrock_messages(message_history)
        model_id = model_id or os.getenv("BEDROCK_MODEL_ID", "")
        if not model_id:
            raise ValueError("Bedrock model_id is required.")

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": messages,
            "max_tokens": 2048,
            "temperature": 0.2
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
