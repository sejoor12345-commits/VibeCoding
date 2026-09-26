"""OpenRouter에 요청을 보내는 공통 함수 모음. 1·2·3단계가 모두 이 파일을 통해 AI를 부른다."""

import json
import os
import re

import requests

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "stealth/space-bunny-alpha"  # 모델을 바꾸려면 이 한 줄만 고치면 된다
TIMEOUT_SECONDS = 60

# 상태 코드별로 사용자에게 보여줄 안내 문구
STATUS_MESSAGES = {
    401: "API 키가 올바르지 않아요.",
    404: "모델을 찾을 수 없어요. 모델 이름을 확인해주세요.",
    429: "요청이 많아요. 잠시 후 다시 시도해주세요.",
}


class OpenRouterError(Exception):
    """화면에 그대로 보여줘도 되는 안내 문구를 담은 오류."""


def get_api_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise OpenRouterError("API 키가 없어요. Colab에서 키를 불러오는 셀을 먼저 실행해주세요.")
    return key


def chat(messages):
    """AI에게 메시지를 보내고 답장 글자를 돌려준다. 실패하면 OpenRouterError를 낸다."""
    try:
        response = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {get_api_key()}"},
            json={"model": MODEL, "messages": messages},
            timeout=TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        raise OpenRouterError("응답이 늦어요. 다시 시도해주세요.")
    except requests.RequestException:
        raise OpenRouterError("OpenRouter에 연결하지 못했어요. 인터넷 연결을 확인해주세요.")

    if response.status_code in STATUS_MESSAGES:
        raise OpenRouterError(STATUS_MESSAGES[response.status_code])
    if response.status_code != 200:
        raise OpenRouterError(f"요청이 실패했어요 (상태 코드 {response.status_code}): {response.text[:300]}")

    try:
        return response.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise OpenRouterError(f"AI 응답을 읽지 못했어요: {response.text[:300]}")


def extract_json(text):
    """AI 답에서 JSON을 꺼낸다. ```json 코드블록이나 앞뒤 설명 글이 붙어 있어도 읽어 본다.

    끝내 읽지 못하면 ValueError를 낸다.
    """
    candidates = [text]

    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        candidates.append(fenced.group(1))

    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start:end + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    raise ValueError("JSON을 찾지 못함")
