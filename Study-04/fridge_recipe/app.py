"""냉장고 재료 인식 & 레시피 추천 앱의 화면(Streamlit). 실행 시작점.

Colab 실행 방법은 PRD_step1.md의 "8. Colab 실행 방법"을 따른다.
Streamlit은 버튼을 누르는 등 화면에서 무언가 할 때마다 이 파일을 위에서 아래로 다시 실행한다.
그래서 다시 실행돼도 남아 있어야 하는 값은 st.session_state에 넣어 둔다.
"""

import streamlit as st

from openrouter_client import OpenRouterError
from recipe import (
    COUNT_OPTIONS,
    DIFFICULTY_OPTIONS,
    SERVING_OPTIONS,
    TIME_OPTIONS,
    RecipeError,
    generate_recipes,
    parse_ingredients,
    recipe_to_markdown,
)
from vision import UnreadableResultError, UnsupportedImageError, recognize_ingredients

ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
CONFIDENCE_MARKS = {"높음": "", "보통": "", "낮음": " ❓"}


def result_to_markdown(result):
    """인식 결과를 화면에 보여줄 표(Markdown)로 만든다."""
    if not result["ingredients"]:
        return "재료를 찾지 못했어요. 냉장고 안이 잘 보이게 다시 찍어주세요."

    lines = [
        f"**찾은 재료 {len(result['ingredients'])}개** (❓ = 확실하지 않음)",
        "",
        "| 재료 | 양 | 확신 정도 |",
        "|---|---|---|",
    ]
    for item in result["ingredients"]:
        mark = CONFIDENCE_MARKS[item["confidence"]]
        name = f"*{item['name']}*" if item["confidence"] == "낮음" else item["name"]
        lines.append(f"| {name}{mark} | {item['amount'] or '-'} | {item['confidence']} |")

    if result["note"]:
        lines += ["", f"📝 {result['note']}"]
    return "\n".join(lines)


def run_recognition(photo):
    """사진으로 재료를 인식하고, 결과를 session_state에 넣는다. 오류는 화면용 메시지로 바꿔 넣는다."""
    try:
        result = recognize_ingredients(photo)
    except (OpenRouterError, UnsupportedImageError) as error:
        st.session_state.message = ("error", str(error))
        return
    except UnreadableResultError as error:
        st.session_state.message = ("error", f"{error} AI 답 원문을 그대로 보여드릴게요.\n\n```\n{error.raw_text}\n```")
        return

    st.session_state.message = ("result", result_to_markdown(result))
    if result["ingredients"]:  # 찾은 게 없으면 사용자가 써 둔 재료 목록은 지우지 않는다
        st.session_state.ingredients_text = ", ".join(item["name"] for item in result["ingredients"])


def run_recipe_generation(exclude_titles=()):
    """입력칸의 재료와 선택한 조건으로 레시피를 만들고, 결과를 session_state에 넣는다."""
    ingredients = parse_ingredients(st.session_state.ingredients_text)
    if not ingredients:
        st.session_state.recipe_error = "재료를 한 개 이상 입력해주세요."
        return

    try:
        recipes = generate_recipes(
            ingredients,
            servings=st.session_state.servings,
            time_limit=TIME_OPTIONS[st.session_state.time_option],
            difficulty=st.session_state.difficulty,
            count=st.session_state.recipe_count,
            exclude_titles=exclude_titles,
        )
    except (OpenRouterError, RecipeError) as error:
        st.session_state.recipe_error = str(error)
        return

    st.session_state.recipes = recipes  # 3단계 저장 기능이 쓸 수 있게 JSON 원본 그대로 보관한다
    st.session_state.recipe_error = None


st.set_page_config(page_title="냉장고 레시피", page_icon="🧊", layout="wide")
st.session_state.setdefault("message", ("info", "사진을 올리고 **재료 인식하기**를 눌러주세요."))
st.session_state.setdefault("ingredients_text", "")
st.session_state.setdefault("recipes", [])
st.session_state.setdefault("recipe_error", None)

st.title("🧊 냉장고 레시피 추천")
st.write("냉장고 사진을 올리면 AI가 재료를 찾고, 그 재료로 만들 수 있는 레시피를 추천해줘요.")

st.header("1. 재료 인식")

left, right = st.columns(2)

with left:
    photo = st.file_uploader("냉장고 사진 (JPG, PNG, WEBP)", type=ALLOWED_EXTENSIONS)
    if photo is not None:
        st.image(photo, caption="미리보기", use_container_width=True)

    if st.button("재료 인식하기", type="primary", use_container_width=True):
        if photo is None:
            st.session_state.message = ("error", "먼저 냉장고 사진을 올려주세요.")
        else:
            with st.spinner("인식 중..."):
                run_recognition(photo)

with right:
    kind, text = st.session_state.message
    if kind == "error":
        st.error(text, icon="⚠️")
    else:
        st.markdown(text)

    st.text_area(
        "재료 목록 (쉼표로 구분, 빠진 재료는 추가하고 틀린 재료는 지워주세요)",
        key="ingredients_text",
        height=100,
        placeholder="예: 달걀, 대파, 우유",
    )

st.divider()
st.header("2. 레시피 추천")
st.caption("위 재료 목록으로 레시피를 만들어요. 사진 없이 재료를 직접 써도 돼요. 소금·후추·설탕·간장·식용유·물은 집에 있다고 가정해요.")

option_columns = st.columns(4)
option_columns[0].selectbox("인분", SERVING_OPTIONS, index=1, format_func=lambda n: f"{n}인분", key="servings")
option_columns[1].selectbox("조리 시간", list(TIME_OPTIONS), index=1, key="time_option")
option_columns[2].selectbox("난이도", DIFFICULTY_OPTIONS, index=0, key="difficulty")
option_columns[3].selectbox("추천 개수", COUNT_OPTIONS, index=2, format_func=lambda n: f"{n}개", key="recipe_count")

button_columns = st.columns(2)
if button_columns[0].button("레시피 추천받기", type="primary", use_container_width=True):
    with st.spinner("레시피 만드는 중..."):
        run_recipe_generation()
if button_columns[1].button("다른 레시피 보기", use_container_width=True, disabled=not st.session_state.recipes):
    with st.spinner("다른 레시피 만드는 중..."):
        run_recipe_generation(exclude_titles=[recipe["title"] for recipe in st.session_state.recipes])

if st.session_state.recipe_error:
    st.error(st.session_state.recipe_error, icon="⚠️")

if st.session_state.recipes:
    card_columns = st.columns(len(st.session_state.recipes))
    for column, recipe in zip(card_columns, st.session_state.recipes):
        with column.container(border=True):
            st.markdown(recipe_to_markdown(recipe))
