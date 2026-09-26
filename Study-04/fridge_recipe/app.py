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
    find_allergens,
    recipe_to_markdown,
)
from storage import (
    DEFAULT_SERVINGS,
    DIET_OPTIONS,
    SKILL_OPTIONS,
    ProfileError,
    create_profile,
    delete_recipe,
    load_data,
    save_recipe,
    update_profile,
)
from vision import UnreadableResultError, UnsupportedImageError, recognize_ingredients

ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
NO_PROFILE = "(프로필 선택 안 함)"
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


def run_recipe_generation(profile, exclude_titles=()):
    """입력칸의 재료와 선택한 조건(+프로필)으로 레시피를 만들고, 결과를 session_state에 넣는다."""
    st.session_state.recipe_notice = None
    ingredients = parse_ingredients(st.session_state.ingredients_text)
    if not ingredients:
        st.session_state.recipe_error = "재료를 한 개 이상 입력해주세요."
        return

    allergens = find_allergens(ingredients, profile["allergies"]) if profile else []
    if allergens:
        st.session_state.recipe_notice = f"알레르기 재료({', '.join(allergens)})가 목록에 있어요. 레시피에서는 빼고 추천할게요."

    try:
        recipes = generate_recipes(
            ingredients,
            servings=st.session_state.servings,
            time_limit=TIME_OPTIONS[st.session_state.time_option],
            difficulty=st.session_state.difficulty,
            count=st.session_state.recipe_count,
            exclude_titles=exclude_titles,
            profile=profile,
        )
    except (OpenRouterError, RecipeError) as error:
        st.session_state.recipe_error = str(error)
        return

    st.session_state.recipes = recipes  # 저장 기능이 쓸 수 있게 JSON 원본 그대로 보관한다
    st.session_state.recipe_source_ingredients = ingredients
    st.session_state.recipe_error = None


# ----- 버튼 콜백 -----
# on_click으로 연결한 함수는 화면을 다시 그리기 "전"에 실행된다.
# 그래서 이미 화면에 있는 입력칸(프로필 선택 상자 등)의 값을 여기서 안전하게 바꿀 수 있다.

def notify(where, text, ok=True):
    """버튼 바로 아래(where 위치)에 보여줄 알림을 남긴다. 화면을 한 번 그린 뒤 지워진다."""
    st.session_state.notice = (where, text, ok)


def show_notice(where):
    """where 위치에 남겨진 알림이 있으면 보여준다."""
    notice = st.session_state.get("notice")
    if notice and notice[0] == where:
        _, text, ok = notice
        (st.success if ok else st.warning)(text, icon="✅" if ok else "⚠️")


def selected_nickname():
    name = st.session_state.get("profile_name", NO_PROFILE)
    return None if name == NO_PROFILE else name


def apply_default_servings():
    """선택한 프로필의 기본 인분을 레시피 조건의 인분에 채운다."""
    nickname = selected_nickname()
    if nickname:
        data, _ = load_data()
        st.session_state.servings = data["profiles"][nickname]["default_servings"]


def on_create_profile():
    try:
        nickname = create_profile(st.session_state.new_nickname)
    except ProfileError as error:
        notify("profile", str(error), ok=False)
        return
    st.session_state.profile_name = nickname
    st.session_state.new_nickname = ""
    apply_default_servings()
    notify("profile", f"'{nickname}' 프로필을 만들었어요! 아래 '프로필 정보 수정'에서 알레르기 등을 입력해보세요.")


def on_save_profile(nickname):
    update_profile(
        nickname,
        allergies=parse_ingredients(st.session_state[f"allergies_{nickname}"]),
        dislikes=parse_ingredients(st.session_state[f"dislikes_{nickname}"]),
        diet=st.session_state[f"diet_{nickname}"],
        skill=st.session_state[f"skill_{nickname}"],
        default_servings=st.session_state[f"servings_{nickname}"],
    )
    apply_default_servings()
    notify("profile", "프로필을 저장했어요!")


def on_save_recipe(index):
    nickname = selected_nickname()
    if not nickname:
        notify(f"card_{index}", "먼저 맨 위에서 프로필을 선택해주세요.", ok=False)
        return
    try:
        save_recipe(nickname, st.session_state.recipes[index], st.session_state.recipe_source_ingredients)
    except ProfileError as error:
        notify(f"card_{index}", str(error), ok=False)
        return
    notify(f"card_{index}", "저장했어요! '⭐ 내 레시피' 탭에서 볼 수 있어요.")


def on_confirm_delete(nickname, recipe_id):
    delete_recipe(nickname, recipe_id)
    st.session_state.confirm_delete = None
    notify("saved", "삭제했어요.")


st.set_page_config(page_title="냉장고 레시피", page_icon="🧊", layout="wide")
st.session_state.setdefault("message", ("info", "사진을 올리고 **재료 인식하기**를 눌러주세요."))
st.session_state.setdefault("ingredients_text", "")
st.session_state.setdefault("recipes", [])
st.session_state.setdefault("recipe_source_ingredients", [])
st.session_state.setdefault("recipe_error", None)
st.session_state.setdefault("recipe_notice", None)
st.session_state.setdefault("servings", DEFAULT_SERVINGS)
st.session_state.setdefault("confirm_delete", None)

data, was_corrupt = load_data()
if was_corrupt:
    notify("profile", "저장 데이터를 읽지 못해 새로 시작했어요. (원래 파일은 profiles.corrupt.json으로 보관했어요)", ok=False)

st.title("🧊 냉장고 레시피 추천")
st.write("냉장고 사진을 올리면 AI가 재료를 찾고, 그 재료로 만들 수 있는 레시피를 추천해줘요.")

# ===== 프로필 =====
nicknames = sorted(data["profiles"])
if st.session_state.get("profile_name") not in [NO_PROFILE] + nicknames:
    st.session_state.profile_name = NO_PROFILE  # 사라진 프로필이 선택돼 있으면 선택을 푼다

with st.container(border=True):
    profile_columns = st.columns([2, 2, 1])
    profile_columns[0].selectbox("👤 프로필", [NO_PROFILE] + nicknames, key="profile_name", on_change=apply_default_servings)
    profile_columns[1].text_input("새 닉네임 (1~20자)", key="new_nickname", placeholder="예: 요리초보")
    profile_columns[2].button("새 프로필 만들기", on_click=on_create_profile, use_container_width=True)
    st.caption("⚠️ 비밀번호가 없어서 앱을 쓰는 누구나 모든 프로필을 볼 수 있어요. 실명 같은 개인정보는 넣지 마세요.")
    show_notice("profile")

    nickname = selected_nickname()
    profile = data["profiles"].get(nickname) if nickname else None
    if profile:
        st.markdown(
            f"**알레르기:** {', '.join(profile['allergies']) or '없음'} · "
            f"**싫어하는 재료:** {', '.join(profile['dislikes']) or '없음'} · "
            f"**식단:** {profile['diet']} · **실력:** {profile['skill']} · **기본 인분:** {profile['default_servings']}인분"
        )
        with st.expander("✏️ 프로필 정보 수정"):
            with st.form(f"profile_form_{nickname}"):
                st.text_input("알레르기 (쉼표로 구분)", value=", ".join(profile["allergies"]), key=f"allergies_{nickname}")
                st.text_input("싫어하는 재료 (쉼표로 구분)", value=", ".join(profile["dislikes"]), key=f"dislikes_{nickname}")
                form_columns = st.columns(3)
                form_columns[0].selectbox("식단 유형", DIET_OPTIONS, index=DIET_OPTIONS.index(profile["diet"]), key=f"diet_{nickname}")
                form_columns[1].selectbox("요리 실력", SKILL_OPTIONS, index=SKILL_OPTIONS.index(profile["skill"]), key=f"skill_{nickname}")
                form_columns[2].selectbox(
                    "기본 인분", SERVING_OPTIONS, index=SERVING_OPTIONS.index(profile["default_servings"]),
                    format_func=lambda n: f"{n}인분", key=f"servings_{nickname}",
                )
                st.form_submit_button("프로필 저장", type="primary", on_click=on_save_profile, args=(nickname,))

recommend_tab, saved_tab = st.tabs(["🍳 레시피 추천", "⭐ 내 레시피"])

# ===== 레시피 추천 탭 (1단계 + 2단계) =====
with recommend_tab:
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
    if profile:
        st.caption(f"👤 '{nickname}' 프로필의 알레르기·식단·실력을 반영해서 추천해요.")

    option_columns = st.columns(4)
    option_columns[0].selectbox("인분", SERVING_OPTIONS, format_func=lambda n: f"{n}인분", key="servings")
    option_columns[1].selectbox("조리 시간", list(TIME_OPTIONS), index=1, key="time_option")
    option_columns[2].selectbox("난이도", DIFFICULTY_OPTIONS, index=0, key="difficulty")
    option_columns[3].selectbox("추천 개수", COUNT_OPTIONS, index=2, format_func=lambda n: f"{n}개", key="recipe_count")

    button_columns = st.columns(2)
    if button_columns[0].button("레시피 추천받기", type="primary", use_container_width=True):
        with st.spinner("레시피 만드는 중..."):
            run_recipe_generation(profile)
    if button_columns[1].button("다른 레시피 보기", use_container_width=True, disabled=not st.session_state.recipes):
        with st.spinner("다른 레시피 만드는 중..."):
            run_recipe_generation(profile, exclude_titles=[recipe["title"] for recipe in st.session_state.recipes])

    if st.session_state.recipe_notice:
        st.warning(st.session_state.recipe_notice, icon="🥜")
    if st.session_state.recipe_error:
        st.error(st.session_state.recipe_error, icon="⚠️")

    if st.session_state.recipes:
        card_columns = st.columns(len(st.session_state.recipes))
        for index, (column, recipe) in enumerate(zip(card_columns, st.session_state.recipes)):
            with column.container(border=True):
                st.markdown(recipe_to_markdown(recipe))
                st.button("⭐ 저장", key=f"save_{index}", on_click=on_save_recipe, args=(index,), use_container_width=True)
                show_notice(f"card_{index}")

# ===== 내 레시피 탭 (3단계) =====
with saved_tab:
    show_notice("saved")
    if not profile:
        st.info("프로필을 선택하면 저장한 레시피를 볼 수 있어요.")
    elif not profile["saved_recipes"]:
        st.info("아직 저장한 레시피가 없어요. 레시피 카드의 ⭐ 저장 버튼을 눌러보세요.")
    else:
        saved_list = sorted(profile["saved_recipes"], key=lambda saved: saved["saved_at"], reverse=True)  # 최신순
        saved_by_id = {saved["id"]: saved for saved in saved_list}

        def describe(recipe_id):
            saved = saved_by_id[recipe_id]
            time_text = f" · ⏱ {saved['recipe']['time_minutes']}분" if saved["recipe"].get("time_minutes") else ""
            return f"{saved['recipe']['title']} · {saved['saved_at'][:10]}{time_text}"

        st.write(f"저장한 레시피 **{len(saved_list)}개**")
        chosen_id = st.selectbox("레시피 고르기", list(saved_by_id), format_func=describe)
        chosen = saved_by_id[chosen_id]

        with st.container(border=True):
            st.markdown(recipe_to_markdown(chosen["recipe"]))
            st.caption(f"저장한 날: {chosen['saved_at'].replace('T', ' ')} · 그때 냉장고 재료: {', '.join(chosen['source_ingredients'])}")

        if st.session_state.confirm_delete == chosen_id:
            st.warning("정말 삭제할까요?")
            confirm_columns = st.columns(2)
            confirm_columns[0].button("네, 삭제할게요", type="primary", on_click=on_confirm_delete, args=(nickname, chosen_id), use_container_width=True)
            if confirm_columns[1].button("취소", use_container_width=True):
                st.session_state.confirm_delete = None
                st.rerun()
        elif st.button("🗑️ 삭제"):
            st.session_state.confirm_delete = chosen_id
            st.rerun()

# 알림은 화면을 끝까지 다 그린 뒤에 지운다. 입력 직후 버튼을 누르면 화면이 연달아 두 번 다시 그려지는데,
# 앞의 것이 중간에 끊기더라도 알림이 사라지지 않게 하기 위해서다.
st.session_state.notice = None
