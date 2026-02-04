import os
import json
from typing import List, Dict, Any, Optional

import google.generativeai as genai


class GeminiAgent:
    def __init__(self):
        self.api_key = (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
        )
        if self.api_key:
            genai.configure(api_key=self.api_key)

    def call_agent(
        self,
        message_history: List[Dict[str, Any]],
        model_id: Optional[str] = None,
        model_params: Optional[Dict[str, Any]] = None,
        image_attachments: Optional[List[Dict[str, Any]]] = None,
        tool_runner=None,
        max_tool_steps: int = 4
    ) -> str:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

        system_message = None
        if message_history:
            for msg in message_history:
                if msg.get("role") == "system":
                    system_message = msg.get("content")
                    break

        if not message_history or message_history[-1].get("role") != "user":
            raise RuntimeError("No user message to process")

        last_user_message = message_history[-1].get("content", "")
        history_messages = message_history[:-1]

        base_history = []
        for msg in history_messages:
            role = msg.get("role")
            if role == "user":
                base_history.append({"role": "user", "parts": [msg.get("content", "")]})
            elif role == "assistant":
                base_history.append({"role": "model", "parts": [msg.get("content", "")]})
            elif role == "tool":
                base_history.append({"role": "user", "parts": [msg.get("content", "")]})

        model_name = model_id or "gemini-3-pro"
        generation_config = {}
        if model_params:
            if model_params.get("temperature") is not None:
                generation_config["temperature"] = model_params["temperature"]
            if model_params.get("top_p") is not None:
                generation_config["top_p"] = model_params["top_p"]
            if model_params.get("max_tokens") is not None:
                generation_config["max_output_tokens"] = model_params["max_tokens"]

        model = genai.GenerativeModel(
            model_name,
            system_instruction=system_message,
            generation_config=generation_config or None
        )
        def parse_tool_call(text: str) -> Optional[Dict[str, Any]]:
            if not text:
                return None
            start = text.find('{"tool"')
            if start == -1:
                return None
            brace_depth = 0
            end = None
            for idx in range(start, len(text)):
                char = text[idx]
                if char == "{":
                    brace_depth += 1
                elif char == "}":
                    brace_depth -= 1
                    if brace_depth == 0:
                        end = idx + 1
                        break
            if end is None:
                return None
            snippet = text[start:end]
            try:
                data = json.loads(snippet)
            except json.JSONDecodeError:
                return None
            if isinstance(data, dict) and "tool" in data:
                return data
            return None

        tool_messages = []
        pending_images = list(image_attachments or [])

        for _ in range(max_tool_steps + 1):
            history_payload = base_history + tool_messages
            chat = model.start_chat(history=history_payload)

            content_parts: List[Any] = []
            if last_user_message:
                content_parts.append(last_user_message)
            if pending_images:
                for attachment in pending_images:
                    if not attachment.get("data") or not attachment.get("mime_type"):
                        continue
                    content_parts.append({
                        "mime_type": attachment["mime_type"],
                        "data": attachment["data"]
                    })
                pending_images = []
            if not content_parts:
                content_parts = [""]

            response = chat.send_message(content_parts)
            response_text = response.text or ""

            tool_call = parse_tool_call(response_text)
            if not tool_call or tool_runner is None:
                return response_text

            tool_name = tool_call.get("tool")
            tool_args = tool_call.get("args") or {}
            tool_result = tool_runner(tool_name, tool_args)

            tool_messages.append({
                "role": "model",
                "parts": [f"Tool call: {json.dumps(tool_call, ensure_ascii=False)}"]
            })
            tool_messages.append({
                "role": "user",
                "parts": [f"Tool result:\n{tool_result}"]
            })
            last_user_message = "Using the tool result above, continue answering the user."

        return "Unable to complete tool-assisted response after multiple attempts."
