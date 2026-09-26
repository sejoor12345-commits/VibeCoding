"""2단계: 재료 목록과 조건으로 AI에게 레시피를 만들어 달라고 하고, 화면용으로 정리한다."""

import json
import re

from openrouter_client import chat, extract_json

# 집에 있다고 가정하는 기본 양념. 부족한 재료 목록에서 빼 준다.
BASIC_SEASONINGS = ["소금", "후추", "설탕", "간장", "식용유", "물"]

SERVING_OPTIONS = [1, 2, 3, 4]
TIME_OPTIONS = {"15분 이내": 15, "30분 이내": 30, "상관없음": None}
DIFFICULTY_OPTIONS = ["쉬움", "보통", "상관없음"]
COUNT_OPTIONS = [1, 2, 3]


class RecipeError(Exception):
    """화면에 그대로 보여줘도 되는 안내 문구를 담은 오류."""


def parse_ingredients(text):
    """'달걀, 대파, 우유' 같은 글자를 ['달걀', '대파', '우유'] 목록으로 바꾼다. 빈 칸과 중복은 뺀다."""
    names = []
    for piece in re.split(r"[,\n]", text):
        name = piece.strip()
        if name and name not in names:
            names.append(name)
    return names


def build_prompt(ingredients, servings, time_limit, difficulty, count, exclude_titles):
    """AI에게 보낼 레시피 요청 글을 만든다."""
    conditions = [f"- {servings}인분 기준으로 재료 양을 쓴다."]
    if time_limit:
        conditions.append(f"- 조리 시간은 {time_limit}분 이내여야 한다.")
    if difficulty != "상관없음":
        conditions.append(f"- 난이도는 \"{difficulty}\"이어야 한다.")
    if exclude_titles:
        conditions.append(f"- 다음 레시피는 이미 추천했으니 제외한다: {', '.join(exclude_titles)}")

    example = {
        "recipes": [{
            "title": "대파 달걀볶음밥",
            "summary": "남은 밥과 대파로 10분 만에 만드는 볶음밥",
            "servings": servings,
            "time_minutes": 15,
            "difficulty": "쉬움",
            "used_ingredients": ["달걀 2개", "대파 1/2대", "밥 2공기"],
            "missing_ingredients": [],
            "steps": ["대파를 잘게 썬다.", "달군 팬에 기름을 두르고 대파를 볶아 파기름을 낸다."],
            "tip": "밥은 찬밥을 쓰면 덜 질어진다.",
        }]
    }

    return f"""냉장고에 있는 재료로 만들 수 있는 요리 레시피를 {count}개 추천해줘.

냉장고 재료: {', '.join(ingredients)}

규칙:
- 냉장고 재료를 최대한 많이 쓰는 레시피를 우선한다.
- {', '.join(BASIC_SEASONINGS)}은 집에 있다고 가정한다. 이것들은 missing_ingredients에 넣지 않는다.
- 그 밖에 냉장고 재료에 없는 재료가 필요하면 missing_ingredients에 적는다. 레시피당 최대 2개까지만 허용한다.
- used_ingredients에는 냉장고 재료 중 이 레시피에 쓰는 것을 양과 함께 적는다.
- 조리 순서(steps)는 초보자도 따라 할 수 있게 한 단계에 한 동작씩 쓴다.
- 추천하는 레시피끼리 서로 겹치지 않게 한다 (예: 볶음밥만 여러 개 X).
- difficulty는 "쉬움", "보통", "어려움" 중 하나로 쓴다. time_minutes는 숫자로 쓴다.
- 냉장고 재료가 음식 재료가 아니어서 레시피를 만들 수 없으면 recipes를 빈 배열로 둔다.
{chr(10).join(conditions)}

반드시 아래 JSON 형식으로만 답해. 다른 설명은 쓰지 마.
{json.dumps(example, ensure_ascii=False)}"""


def to_text_list(value):
    """문자열 목록이어야 하는 값을 정리한다 (빈 값 제거, 목록이 아니면 빈 목록)."""
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def is_basic_seasoning(item):
    """'간장 1큰술'처럼 기본 양념으로 시작하는 재료인지 확인한다."""
    words = item.split()
    return bool(words) and words[0] in BASIC_SEASONINGS


def normalize_recipes(data, count):
    """AI가 준 JSON에서 제목과 조리 순서가 있는 레시피만 골라 정리한다."""
    if not isinstance(data, dict) or not isinstance(data.get("recipes"), list):
        raise ValueError("recipes 목록이 없음")

    recipes = []
    for item in data["recipes"]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        steps = to_text_list(item.get("steps"))
        if not title or not steps:
            continue  # 필수 항목이 빠진 레시피는 버린다

        recipes.append({
            "title": title,
            "summary": str(item.get("summary") or "").strip(),
            "servings": item.get("servings"),
            "time_minutes": item.get("time_minutes"),
            "difficulty": str(item.get("difficulty") or "").strip(),
            "used_ingredients": to_text_list(item.get("used_ingredients")),
            "missing_ingredients": [x for x in to_text_list(item.get("missing_ingredients")) if not is_basic_seasoning(x)],
            "steps": steps,
            "tip": str(item.get("tip") or "").strip(),
        })
    return recipes[:count]


def generate_recipes(ingredients, servings, time_limit, difficulty, count, exclude_titles=()):
    """재료와 조건으로 레시피 목록을 만든다. 실패하면 RecipeError(또는 OpenRouterError)를 낸다."""
    answer = chat([{
        "role": "user",
        "content": build_prompt(ingredients, servings, time_limit, difficulty, count, list(exclude_titles)),
    }])

    try:
        data = extract_json(answer)
        recipes = normalize_recipes(data, count)
    except ValueError:
        raise RecipeError("레시피를 만들지 못했어요. 다시 시도해주세요.")

    if not recipes:
        if not data["recipes"]:  # AI가 일부러 빈 목록을 준 경우 (음식 재료가 아님)
            raise RecipeError("이 재료로는 레시피를 만들기 어려워요.")
        raise RecipeError("레시피를 만들지 못했어요. 다시 시도해주세요.")
    return recipes


def recipe_to_markdown(recipe):
    """레시피 하나를 카드에 넣을 Markdown 글자로 만든다."""
    info = []
    if recipe["time_minutes"]:
        info.append(f"⏱ {recipe['time_minutes']}분")
    if recipe["servings"]:
        info.append(f"👤 {recipe['servings']}인분")
    if recipe["difficulty"]:
        info.append(recipe["difficulty"])

    lines = [f"### {recipe['title']}"]
    if recipe["summary"]:
        lines.append(recipe["summary"])
    if info:
        lines += ["", " · ".join(info)]

    lines += ["", f"**🧊 냉장고 재료:** {', '.join(recipe['used_ingredients']) or '-'}"]

    if recipe["missing_ingredients"]:
        lines += ["", f"**🛒 부족한 재료:** :orange[{', '.join(recipe['missing_ingredients'])}]"]
    else:
        lines += ["", ":green[**✅ 냉장고 재료만으로 가능!**]"]

    lines += ["", "**조리 순서**"]
    lines += [f"{number}. {step}" for number, step in enumerate(recipe["steps"], start=1)]

    if recipe["tip"]:
        lines += ["", f"💡 {recipe['tip']}"]
    return "\n".join(lines)
