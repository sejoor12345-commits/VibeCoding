"""냉장고 재료 인식 & 레시피 추천 앱의 화면(Streamlit). 실행 시작점.

Colab 실행 방법은 PRD_step1.md의 "8. Colab 실행 방법"을 따른다.
Streamlit은 버튼을 누르는 등 화면에서 무언가 할 때마다 이 파일을 위에서 아래로 다시 실행한다.
그래서 다시 실행돼도 남아 있어야 하는 값은 st.session_state에 넣어 둔다.
"""

import streamlit as st

from openrouter_client import OpenRouterError
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


st.set_page_config(page_title="냉장고 레시피", page_icon="🧊", layout="wide")
st.session_state.setdefault("message", ("info", "사진을 올리고 **재료 인식하기**를 눌러주세요."))
st.session_state.setdefault("ingredients_text", "")

st.title("🧊 냉장고 재료 인식")
st.write("냉장고 사진을 올리면 AI가 안에 있는 재료를 찾아줘요.")

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
