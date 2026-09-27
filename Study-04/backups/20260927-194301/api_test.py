"""OpenRouter API가 실제로 작동하는지 확인하는 테스트.

1) 텍스트 인식: 질문을 보내고 답을 받는다.
2) 이미지 인식: 그림을 직접 만들어 보내고, 무엇이 보이는지 설명을 받는다.

실행 전에 Colab 셀에서 보안 비밀의 키를 환경 변수로 옮겨 둬야 한다:
    import os
    from google.colab import userdata
    os.environ["OPENROUTER_API_KEY"] = userdata.get("OPENROUTER_API_KEY")
"""

import base64
import io
import os

import requests
from PIL import Image, ImageDraw

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "stealth/space-bunny-alpha"


def get_api_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENROUTER_API_KEY가 없습니다. Colab 보안 비밀에서 키를 불러오는 셀을 먼저 실행하세요."
        )
    return key


def send(messages):
    """AI에게 메시지를 보내고 답장 글자만 돌려준다. 실패하면 서버가 보낸 오류 내용을 보여준다."""
    response = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {get_api_key()}"},
        json={"model": MODEL, "messages": messages},
        timeout=120,
    )
    if response.status_code != 200:
        raise RuntimeError(f"요청 실패 (상태 코드 {response.status_code}): {response.text}")
    return response.json()["choices"][0]["message"]["content"]


def make_test_image():
    """흰 배경에 빨간 원, 파란 사각형, 'HELLO 2026' 글자가 있는 그림을 만들어 base64 문자열로 돌려준다."""
    image = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.ellipse((40, 60, 160, 180), fill="red")
    draw.rectangle((240, 60, 360, 180), fill="blue")
    draw.text((150, 230), "HELLO 2026", fill="black")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def test_text():
    print("=== 1. 텍스트 인식 테스트 ===")
    answer = send([{"role": "user", "content": "대한민국의 수도는 어디야? 한 문장으로 답해줘."}])
    print("AI 답변:", answer)


def test_image():
    print("=== 2. 이미지 인식 테스트 ===")
    print("(보낸 그림: 흰 배경, 왼쪽 빨간 원, 오른쪽 파란 사각형, 아래쪽 'HELLO 2026' 글자)")
    image_base64 = make_test_image()
    answer = send([
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "이 그림에 무엇이 있는지 도형, 색깔, 글자를 한국어로 설명해줘."},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
            ],
        }
    ])
    print("AI 답변:", answer)


if __name__ == "__main__":
    print("사용 모델:", MODEL)
    print()
    for test in (test_text, test_image):
        try:
            test()
        except Exception as error:
            print("실패:", error)
        print()
