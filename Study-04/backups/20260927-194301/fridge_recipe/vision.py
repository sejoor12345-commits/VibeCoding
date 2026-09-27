"""1단계: 냉장고 사진을 AI에게 보내 식재료 목록을 받아온다."""

import base64
import io

from PIL import Image, ImageOps, UnidentifiedImageError

from openrouter_client import VISION_MODEL, chat, extract_json

MAX_SIDE = 1024  # 사진의 긴 변을 이 크기(px)까지 줄여서 보낸다
ALLOWED_FORMATS = {"JPEG", "MPO", "PNG", "WEBP"}  # MPO: 휴대폰 JPG 중 사진 여러 장이 들어 있는 것 (인물 사진 모드 등)
CONFIDENCE_LEVELS = ("높음", "보통", "낮음")

PROMPT = """이 사진은 냉장고 안을 찍은 사진이야. 사진에 보이는 식재료를 찾아줘.

규칙:
- 먹을 수 있는 식재료만 찾는다. 그릇, 용기, 냉장고 부품은 제외한다.
- 재료 이름은 한국어 일반 명칭으로 쓴다. 같은 재료는 한 가지 이름으로 통일한다 (예: 계란 → 달걀).
- 양은 사진에서 보이는 만큼 대략적으로 쓴다 (예: "약 6개", "1팩", "반 병").
- 포장 때문에 무엇인지 확실하지 않으면 confidence를 "낮음"으로 한다.
- confidence는 "높음", "보통", "낮음" 중 하나만 쓴다.
- 사진 전체에 대해 덧붙일 말이 있으면 note에 한 문장으로 쓰고, 없으면 빈 문자열로 둔다.
- 식재료가 하나도 없으면 ingredients를 빈 배열로 둔다.

반드시 아래 JSON 형식으로만 답해. 다른 설명은 쓰지 마.
{"ingredients": [{"name": "달걀", "amount": "약 6개", "confidence": "높음"}], "note": ""}"""


class UnsupportedImageError(Exception):
    """화면에 그대로 보여줘도 되는 안내 문구를 담은 오류."""


class UnreadableResultError(Exception):
    """AI 답을 JSON으로 읽지 못했을 때. raw_text에 AI 답 원문을 담는다."""

    def __init__(self, raw_text):
        super().__init__("AI 답을 재료 목록으로 읽지 못했어요.")
        self.raw_text = raw_text


def prepare_image(photo):
    """사진(파일 경로 또는 업로드된 파일)을 열어 방향을 바로잡고, 크기를 줄인 JPEG 사진(bytes)으로 돌려준다.

    열 수 없는 사진(확장자만 바꾼 파일, 중간이 잘린 파일, 너무 큰 사진)이면 UnsupportedImageError를 낸다.
    """
    try:
        image = Image.open(photo)
        if image.format not in ALLOWED_FORMATS:
            raise UnsupportedImageError("JPG, PNG, WEBP 사진만 올릴 수 있어요. JPG나 PNG로 바꿔서 올려주세요.")

        image = ImageOps.exif_transpose(image)  # 휴대폰 사진이 옆으로 누워 보이는 문제를 바로잡는다
        image = image.convert("RGB")  # 투명 배경(PNG) 등을 JPEG로 저장할 수 있게 바꾼다
        image.thumbnail((MAX_SIDE, MAX_SIDE))  # 비율을 유지하며 긴 변을 MAX_SIDE 이하로 줄인다

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        # 사진을 실제로 풀어 보는 중에도(중간이 잘린 파일 등) 오류가 날 수 있어서, 여는 것부터 저장까지 한꺼번에 감싼다
        raise UnsupportedImageError("사진을 열 수 없어요. JPG나 PNG로 바꿔서 올려주세요.")
    return buffer.getvalue()


def normalize_result(data):
    """AI가 준 JSON을 {"ingredients": [...], "note": "..."} 모양으로 정리한다. 이름 없는 항목은 버린다."""
    if not isinstance(data, dict):
        raise ValueError("JSON 최상위가 객체가 아님")

    items = data.get("ingredients") or []
    if not isinstance(items, list):
        raise ValueError("ingredients가 목록이 아님")

    ingredients = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        confidence = str(item.get("confidence") or "").strip()
        ingredients.append({
            "name": name,
            "amount": str(item.get("amount") or "").strip(),
            "confidence": confidence if confidence in CONFIDENCE_LEVELS else "보통",
        })

    return {"ingredients": ingredients, "note": str(data.get("note") or "").strip()}


def recognize_ingredients(image_jpeg):
    """prepare_image로 줄인 사진(JPEG bytes)을 AI에게 보내 재료를 인식하고, 정리된 결과를 돌려준다."""
    image_base64 = base64.b64encode(image_jpeg).decode("ascii")
    answer = chat([
        {
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
            ],
        }
    ], model=VISION_MODEL)

    try:
        return normalize_result(extract_json(answer))
    except ValueError:
        raise UnreadableResultError(answer)
