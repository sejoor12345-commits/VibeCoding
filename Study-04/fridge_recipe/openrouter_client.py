"""OpenRouter에 요청을 보내는 공통 함수 모음. 1·2·3단계가 모두 이 파일을 통해 AI를 부른다."""

import json
import os
import re
import time

import requests

API_URL = "https://openrouter.ai/api/v1/chat/completions"
# 사용할 AI 모델. 모델을 바꾸려면 여기만 고치면 된다
TEXT_MODEL = "stealth/space-bunny-alpha"  # 글자만 주고받는 일 (레시피 생성)
VISION_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"  # 사진을 보는 일 (재료 인식)
TIMEOUT_SECONDS = 120  # 요청 하나에 기다리는 최대 시간(초). 이 시간이 지나면 포기하고 TIMEOUT_MESSAGE를 띄운다
SILENCE_SECONDS = 30  # 서버가 이 시간 동안 아무것도 안 보내면 연결이 끊긴 것으로 본다
# 사용자에게 보여줄 안내 문구. "무엇이 잘못됐는지 + 어떻게 하면 되는지"를 함께 쓴다
TIMEOUT_MESSAGE = "AI 답이 너무 늦어서 기다리기를 멈췄어요. AI 서버가 바쁜 것 같아요. 잠시 후 다시 시도해주세요."
CONNECT_MESSAGE = "AI 서버(OpenRouter)에 연결하지 못했어요. 잠시 후 다시 시도해주세요."
# 앱(Streamlit 서버)은 켜질 때의 환경 변수만 본다. 그래서 키를 다시 불러온 뒤에는 앱을 켜는 셀도 다시 실행해야 한다
NO_KEY_MESSAGE = "API 키가 없어요. Colab에서 키를 불러오는 셀을 실행한 다음, 앱을 켜는 셀(streamlit run)도 다시 실행해주세요."

# 상태 코드별로 사용자에게 보여줄 안내 문구
STATUS_MESSAGES = {
    401: (
        "API 키가 올바르지 않아요. Colab 보안 비밀(🔑)에 넣은 OPENROUTER_API_KEY 값을 확인한 다음, "
        "키를 불러오는 셀과 앱을 켜는 셀(streamlit run)을 다시 실행해주세요."
    ),
    429: "AI 요청이 몰려서 잠시 막혔어요. 1분쯤 뒤에 다시 시도해주세요. 계속 이러면 오늘 쓸 수 있는 무료 사용량을 다 쓴 것일 수 있어요.",
}


class OpenRouterError(Exception):
    """화면에 그대로 보여줘도 되는 안내 문구를 담은 오류."""


def get_api_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise OpenRouterError(NO_KEY_MESSAGE)
    return key


def error_detail(body):
    """오류 응답에서 원인 설명만 짧게 꺼낸다. 예: {"error": {"message": "Provider returned error"}} → "Provider returned error".

    영어 원문 전체를 보여주면 읽기 어려우므로, 안내 문구 맨 뒤에 괄호로 짧게 덧붙이는 데 쓴다.
    """
    try:
        detail = json.loads(body)["error"]["message"]
    except (ValueError, KeyError, TypeError):
        detail = body
    return str(detail).strip()[:150] or "내용 없음"


def read_body_with_deadline(response, deadline):
    """응답 내용을 조금씩 받으면서, 전체 시간이 deadline을 넘으면 멈춘다.

    requests의 timeout은 "서버가 조용한 시간"만 재기 때문에, OpenRouter처럼 답을 준비하는 동안
    몇 초마다 빈 글자를 보내 연결을 유지하는 서버에서는 영원히 기다리게 된다. 그래서 전체 시간을 직접 잰다.
    """
    chunks = []
    # 한 글자씩 받는다. 크게 받으면 빈 글자가 조금씩 올 때 그만큼 찰 때까지 기다리느라 시간을 못 잰다.
    # (답 크기는 몇 KB 정도라 한 글자씩 받아도 느리지 않다)
    for chunk in response.iter_content(chunk_size=1):
        chunks.append(chunk)
        if time.monotonic() > deadline:
            raise OpenRouterError(TIMEOUT_MESSAGE)
    return b"".join(chunks).decode("utf-8", errors="replace")


def chat(messages, model=TEXT_MODEL):
    """AI(model)에게 메시지를 보내고 답장 글자를 돌려준다. 실패하면 OpenRouterError를 낸다."""
    deadline = time.monotonic() + TIMEOUT_SECONDS
    try:
        with requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {get_api_key()}"},
            json={"model": model, "messages": messages},
            timeout=(10, SILENCE_SECONDS),  # (연결까지, 조용한 시간) 최대 초
            stream=True,  # 답을 한 번에 받지 않고 조금씩 받아서 전체 시간을 잴 수 있게 한다
        ) as response:
            body = read_body_with_deadline(response, deadline)
    except requests.ConnectTimeout:  # 10초 안에 연결조차 못 한 경우. Timeout의 한 종류라서 Timeout보다 먼저 확인한다
        raise OpenRouterError(CONNECT_MESSAGE)
    except requests.Timeout:
        raise OpenRouterError(TIMEOUT_MESSAGE)
    except requests.ConnectionError as error:
        if "timed out" in str(error).lower():  # 받는 도중에 서버가 조용해진 경우
            raise OpenRouterError(TIMEOUT_MESSAGE)
        raise OpenRouterError(CONNECT_MESSAGE)
    except requests.RequestException:
        raise OpenRouterError(CONNECT_MESSAGE)

    if response.status_code == 404:
        raise OpenRouterError(
            f"AI 모델({model})을 찾을 수 없어요. 모델 이름이 바뀌었거나 서비스가 끝났을 수 있어요. "
            "openrouter_client.py의 모델 이름을 확인해주세요."
        )
    if response.status_code in STATUS_MESSAGES:
        raise OpenRouterError(STATUS_MESSAGES[response.status_code])
    if response.status_code != 200:
        raise OpenRouterError(
            f"AI 서버가 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요. "
            f"(상태 코드 {response.status_code}: {error_detail(body)})"
        )

    try:
        content = json.loads(body)["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise OpenRouterError(f"AI 서버의 답을 읽지 못했어요. 잠시 후 다시 시도해주세요. (받은 내용: {error_detail(body)})")

    # 생각하고 답하는 모델(reasoning)은 생각 과정을 <think>...</think>로 답 앞에 붙이기도 한다. 답만 남긴다.
    content = re.sub(r"<think>.*?</think>", "", content or "", flags=re.DOTALL).strip()
    if "</think>" in content:  # 여는 <think> 없이 "생각...</think>답"으로 오는 경우도 있다
        content = content.rsplit("</think>", 1)[1].strip()
    if not content:
        raise OpenRouterError("AI가 빈 답을 보냈어요. 생각하는 데 시간을 다 쓴 것 같아요. 다시 시도해주세요.")
    return content


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
