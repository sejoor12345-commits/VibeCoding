"""OpenRouter API로 AI에게 질문 하나를 보내고 답을 출력하는 가장 기본 예제."""

import os

import requests

API_URL = "https://openrouter.ai/api/v1/chat/completions"

# 사용할 AI 모델. 이름 끝에 ":free"가 붙은 모델은 무료로 쓸 수 있다.
# 무료 모델 목록은 자주 바뀌니, 오류가 나면 https://openrouter.ai/models 에서 "free"로 검색해 바꾼다.
MODEL = "meta-llama/llama-3.3-70b-instruct:free"


def get_api_key():
    """환경 변수에서 API 키를 꺼낸다. 코드 안에 키를 직접 적지 않기 위해서다."""
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENROUTER_API_KEY가 없습니다. Colab 보안 비밀에서 키를 불러오는 셀을 먼저 실행하세요."
        )
    return key


def ask(question):
    response = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {get_api_key()}"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": question}],
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


if __name__ == "__main__":
    print(ask("안녕! 너는 누구야? 한 문장으로 소개해줘."))
