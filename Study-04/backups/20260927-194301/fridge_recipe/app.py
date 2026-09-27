"""냉장고 재료 인식 & 레시피 추천 앱의 화면(Streamlit). 실행 시작점.

Colab 실행 방법은 PRD_step1.md의 "8. Colab 실행 방법"을 따른다.
Streamlit은 버튼을 누르는 등 화면에서 무언가 할 때마다 이 파일을 위에서 아래로 다시 실행한다.
그래서 다시 실행돼도 남아 있어야 하는 값은 st.session_state에 넣어 둔다.
"""

import streamlit as st

from openrouter_client import TIMEOUT_SECONDS, OpenRouterError
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
    empty_data,
    get_profile,
    load_data,
    save_recipe,
    update_profile,
)
from vision import UnreadableResultError, UnsupportedImageError, prepare_image, recognize_ingredients

ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]
NO_PROFILE = "(프로필 선택 안 함)"
PREVIEW_WIDTH = 320  # 미리보기 사진 폭(px). 세로로 긴 휴대폰 사진도 화면을 다 차지하지 않게 작게 보여준다
START_MESSAGE = ("info", "사진을 올리고 **재료 인식하기**를 누르면, AI가 찾은 재료가 여기에 나와요.")
# 기다리는 동안 보여줄 안내. 기다리는 중에 버튼이나 입력칸을 건드리면 Streamlit이 실행을 멈춰서 AI 답이 버려지므로
# 그걸 굵은 글씨로 알린다 (스크롤은 다시 실행되지 않아서 괜찮다). "  \n"은 Markdown 줄바꿈이다
WAIT_HINT = (
    f"보통 30초~1분, 길면 {TIMEOUT_SECONDS // 60}분 걸려요.  \n"
    "**⚠️ 끝날 때까지 다른 버튼이나 입력칸을 건드리지 마세요.** 건드리면 요청이 취소돼요 (스크롤은 괜찮아요)."
)
CONFIDENCE_MARKS = {"높음": "", "보통": "", "낮음": " ❓"}


def result_to_markdown(result):
    """인식 결과를 화면에 보여줄 표(Markdown)로 만든다. 재료가 하나 이상 있을 때만 부른다."""
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


def prepare_photo(photo):
    """올린 사진을 줄인 JPEG로 바꿔 (줄인 사진, 오류 문구)로 돌려준다. 열 수 없는 사진이면 줄인 사진이 None.

    화면이 다시 그려질 때마다 큰 원본 사진을 다시 줄이지 않도록, 사진마다 붙는 번호(file_id)를 기준으로
    처음 한 번만 줄이고 결과를 session_state에 보관해 다시 쓴다. 미리보기와 재료 인식 모두 이 사진을 쓴다.
    """
    if st.session_state.get("photo_id") != photo.file_id:
        try:
            st.session_state.prepared_photo = (prepare_image(photo), None)
        except UnsupportedImageError as error:
            st.session_state.prepared_photo = (None, str(error))
        st.session_state.photo_id = photo.file_id
        # 새 사진이면 결과 칸을 처음 안내로 되돌린다. 이전 사진의 결과나 오류가 새 사진 옆에 남아 있으면 헷갈린다
        st.session_state.message = START_MESSAGE
    return st.session_state.prepared_photo


def run_recognition(photo_jpeg):
    """줄인 사진으로 재료를 인식하고, 결과를 session_state에 넣는다. 오류는 화면용 메시지로 바꿔 넣는다."""
    try:
        result = recognize_ingredients(photo_jpeg)
    except OpenRouterError as error:
        st.session_state.message = ("error", str(error))
        return
    except UnreadableResultError as error:
        st.session_state.message = ("error", (
            f"{error} **재료 인식하기**를 한 번 더 누르거나, 아래 AI 답을 보고 재료 목록 칸에 직접 써주세요."
            f"\n\n```\n{error.raw_text}\n```"
        ))
        return

    if not result["ingredients"]:  # 찾은 게 없으면 사용자가 써 둔 재료 목록은 지우지 않는다
        text = "사진에서 재료를 찾지 못했어요. 냉장고 안이 잘 보이게 밝은 곳에서 다시 찍어 올리거나, 아래 재료 목록 칸에 직접 써주세요."
        if result["note"]:
            text += f"\n\n📝 {result['note']}"
        st.session_state.message = ("warning", text)
        return

    st.session_state.message = ("result", result_to_markdown(result))
    st.session_state.ingredients_text = ", ".join(item["name"] for item in result["ingredients"])


def run_recipe_generation(profile, exclude_titles=()):
    """입력칸의 재료와 선택한 조건(+프로필)으로 레시피를 만들고, 결과를 session_state에 넣는다.

    오류는 버튼 아래 알림(notify)으로 한 번만 보여준다. 재료를 고치는 등 화면을 다시 그리면 사라진다.
    """
    st.session_state.recipe_notice = None
    ingredients = parse_ingredients(st.session_state.ingredients_text)
    if not ingredients:
        notify("recipe", "재료 목록이 비어 있어요. 위에서 사진으로 재료를 찾거나, 재료 목록 칸에 재료를 직접 써주세요 (예: 달걀, 대파).", ok=False)
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
        notify("recipe", str(error), ok=False)
        return

    st.session_state.recipes = recipes  # 저장 기능이 쓸 수 있게 JSON 원본 그대로 보관한다
    st.session_state.recipe_source_ingredients = ingredients


# ----- 버튼 콜백 -----
# on_click으로 연결한 함수는 화면을 다시 그리기 "전"에 실행된다.
# 그래서 이미 화면에 있는 입력칸(프로필 선택 상자 등)의 값을 여기서 안전하게 바꿀 수 있다.

def notify(where, text, ok=True):
    """버튼 바로 아래(where 위치)에 보여줄 알림을 남긴다. 화면을 한 번 그린 뒤 지워진다."""
    st.session_state.notice = (where, text, ok)


def show_notice(where):
    """where 위치에 남겨진 알림이 있으면 보여준다.

    알림이 없어도 빈 자리(st.empty)는 늘 만들어 둔다. 알림이 생기거나 사라져서 아래 요소들의 순서가 바뀌면
    Streamlit이 그 요소들을 새로 그리는데, 이때 펼쳐 둔 '프로필 정보 수정' 상자가 접혀 버리기 때문이다.
    """
    slot = st.empty()
    notice = st.session_state.get("notice")
    if notice and notice[0] == where:
        _, text, ok = notice
        (slot.success if ok else slot.warning)(text, icon="✅" if ok else "⚠️")


def selected_nickname():
    name = st.session_state.get("profile_name", NO_PROFILE)
    return None if name == NO_PROFILE else name


def apply_default_servings():
    """선택한 프로필의 기본 인분을 레시피 조건의 인분에 채운다."""
    nickname = selected_nickname()
    if not nickname:
        return
    try:
        profile = get_profile(nickname)
    except ProfileError as error:
        notify("profile", str(error), ok=False)
        return
    if profile:  # 그사이 프로필이 사라졌으면 아무것도 하지 않는다
        st.session_state.servings = profile["default_servings"]


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
    try:
        update_profile(
            nickname,
            allergies=parse_ingredients(st.session_state[f"allergies_{nickname}"]),
            dislikes=parse_ingredients(st.session_state[f"dislikes_{nickname}"]),
            diet=st.session_state[f"diet_{nickname}"],
            skill=st.session_state[f"skill_{nickname}"],
            default_servings=st.session_state[f"servings_{nickname}"],
        )
    except ProfileError as error:  # 프로필이 사라졌거나 파일 오류면 수정 상자가 안 보일 수 있어서 맨 위에 띄운다
        notify("profile", str(error), ok=False)
        return
    apply_default_servings()
    notify("profile_form", "프로필을 저장했어요!")  # 프로필 저장 버튼 바로 아래에 보여준다


def on_save_recipe(index):
    nickname = selected_nickname()
    if not nickname:
        notify(f"card_{index}", "저장하려면 맨 위에서 프로필을 선택하거나 새로 만들어주세요. 추천받은 레시피는 그대로 남아 있어요.", ok=False)
        return
    try:
        save_recipe(nickname, st.session_state.recipes[index], st.session_state.recipe_source_ingredients)
    except ProfileError as error:
        notify(f"card_{index}", str(error), ok=False)
        return
    notify(f"card_{index}", "저장했어요! 맨 위 '⭐ 내 레시피' 탭에서 볼 수 있어요.")


def on_confirm_delete(nickname, recipe_id, title):
    try:
        delete_recipe(nickname, recipe_id)
    except ProfileError as error:
        notify("saved", str(error), ok=False)
        return
    st.session_state.confirm_delete = None
    notify("saved", f"'{title}' 레시피를 삭제했어요.")


st.set_page_config(page_title="냉장고 레시피", page_icon="🧊", layout="wide")
st.session_state.setdefault("message", START_MESSAGE)
st.session_state.setdefault("ingredients_text", "")
st.session_state.setdefault("recipes", [])
st.session_state.setdefault("recipe_source_ingredients", [])
st.session_state.setdefault("recipe_notice", None)
st.session_state.setdefault("servings", DEFAULT_SERVINGS)
st.session_state.setdefault("confirm_delete", None)

try:
    data = load_data()
except ProfileError as error:  # 저장 파일이 손상됐거나 Drive 연결이 끊긴 경우. 사진 인식, 레시피 추천은 계속 쓸 수 있게 한다
    notify("profile", str(error), ok=False)
    data = empty_data()

st.title("🧊 냉장고 레시피 추천")
st.write("냉장고 사진을 올리면 AI가 재료를 찾고, 그 재료로 만들 수 있는 레시피를 추천해줘요.")
st.markdown("**이렇게 써요:** ① 사진 올리고 **재료 인식하기** → ② 재료 목록 확인 → ③ **레시피 추천받기** → ④ 마음에 들면 **⭐ 저장**")

# ===== 프로필 =====
nicknames = sorted(data["profiles"])
if st.session_state.get("profile_name") not in [NO_PROFILE] + nicknames:
    st.session_state.profile_name = NO_PROFILE  # 사라진 프로필이 선택돼 있으면 선택을 푼다

with st.container(border=True):
    profile_columns = st.columns([2, 2, 1], vertical_alignment="bottom")  # 버튼을 입력칸과 같은 높이에 맞춘다
    profile_columns[0].selectbox("👤 프로필", [NO_PROFILE] + nicknames, key="profile_name", on_change=apply_default_servings)
    profile_columns[1].text_input("새 닉네임 (1~20자)", key="new_nickname", placeholder="예: 요리초보")
    profile_columns[2].button("새 프로필 만들기", on_click=on_create_profile, width="stretch")
    st.caption(
        "프로필은 없어도 돼요. 만들어 두면 알레르기·식단을 반영해서 추천받고, 마음에 드는 레시피를 저장할 수 있어요.  \n"
        "⚠️ 비밀번호가 없어서 앱을 쓰는 누구나 모든 프로필을 볼 수 있어요. 실명 같은 개인정보는 넣지 마세요."
    )
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
        show_notice("profile_form")  # 저장 결과는 펼침 상자 바로 아래(= 프로필 저장 버튼 바로 아래)에 보여준다

recommend_tab, saved_tab = st.tabs(["🍳 레시피 추천", "⭐ 내 레시피"])

# ===== 레시피 추천 탭 (1단계 + 2단계) =====
with recommend_tab:
    st.header("1. 재료 인식")
    left, right = st.columns(2)

    with left:
        photo = st.file_uploader("냉장고 사진 (JPG, PNG, WEBP)", type=ALLOWED_EXTENSIONS)
        st.caption("아이폰 HEIC 사진은 사진 앱에서 JPG로 내보내서 올려주세요. 파일 이름의 확장자만 바꾸면 열리지 않아요.")
        photo_jpeg, photo_error = prepare_photo(photo) if photo is not None else (None, None)
        if photo_error:
            st.error(photo_error, icon="⚠️")

        # 버튼을 미리보기보다 위에 둔다. 세로로 긴 사진이면 버튼이 한참 아래로 밀려서,
        # 버튼을 누른 자리에서는 오른쪽 위에 나온 결과가 화면 밖에 있어 안 보였다
        if st.button("재료 인식하기", type="primary", width="stretch", disabled=photo_error is not None):
            if photo_jpeg is None:
                notify("recognize", "먼저 위에서 냉장고 사진을 올려주세요. 사진이 없으면 재료 목록 칸에 재료를 직접 써도 돼요.", ok=False)
            else:
                with st.spinner(f"AI가 사진 속 재료를 찾고 있어요. {WAIT_HINT}", show_time=True):
                    run_recognition(photo_jpeg)
        show_notice("recognize")

        if photo_jpeg:
            st.image(photo_jpeg, caption="미리보기", width=PREVIEW_WIDTH)

    with right:
        kind, text = st.session_state.message
        if kind == "error":
            st.error(text, icon="⚠️")
        elif kind == "warning":
            st.warning(text, icon="🔍")
        else:
            st.markdown(text)

        st.text_area(
            "재료 목록 (쉼표로 구분, 빠진 재료는 추가하고 틀린 재료는 지워주세요)",
            key="ingredients_text",
            height=100,
            placeholder="예: 달걀, 대파, 우유",
        )
        st.caption("재료 목록을 다 확인했으면 아래 **2. 레시피 추천**에서 **레시피 추천받기**를 눌러주세요.")

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
    if button_columns[0].button("레시피 추천받기", type="primary", width="stretch"):
        with st.spinner(f"AI가 레시피를 만들고 있어요. {WAIT_HINT}", show_time=True):
            run_recipe_generation(profile)
    if button_columns[1].button(
        "다른 레시피 보기", width="stretch", disabled=not st.session_state.recipes,
        help="지금 보이는 레시피를 빼고 새로 추천받아요. 레시피를 한 번 추천받은 뒤에 누를 수 있어요.",
    ):
        with st.spinner(f"AI가 다른 레시피를 만들고 있어요. {WAIT_HINT}", show_time=True):
            run_recipe_generation(profile, exclude_titles=[recipe["title"] for recipe in st.session_state.recipes])

    if st.session_state.recipe_notice:
        st.warning(st.session_state.recipe_notice, icon="🥜")
    show_notice("recipe")

    if st.session_state.recipes:
        card_columns = st.columns(len(st.session_state.recipes))
        for index, (column, recipe) in enumerate(zip(card_columns, st.session_state.recipes)):
            with column.container(border=True):
                st.markdown(recipe_to_markdown(recipe))
                st.button("⭐ 저장", key=f"save_{index}", on_click=on_save_recipe, args=(index,), width="stretch")
                show_notice(f"card_{index}")

# ===== 내 레시피 탭 (3단계) =====
with saved_tab:
    show_notice("saved")
    if not profile:
        st.info("맨 위에서 프로필을 선택하면 그 프로필에 저장한 레시피를 볼 수 있어요.")
    elif not profile["saved_recipes"]:
        st.info("아직 저장한 레시피가 없어요. '🍳 레시피 추천' 탭에서 레시피를 받은 뒤, 마음에 드는 카드의 ⭐ 저장 버튼을 눌러보세요.")
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
            st.warning(f"'{chosen['recipe']['title']}' 레시피를 정말 삭제할까요? 삭제하면 되돌릴 수 없어요.")
            confirm_columns = st.columns(2)
            confirm_columns[0].button(
                "네, 삭제할게요", type="primary", on_click=on_confirm_delete,
                args=(nickname, chosen_id, chosen["recipe"]["title"]), width="stretch",
            )
            if confirm_columns[1].button("취소", width="stretch"):
                st.session_state.confirm_delete = None
                st.rerun()
        elif st.button("🗑️ 삭제"):
            st.session_state.confirm_delete = chosen_id
            st.rerun()

# 알림은 화면을 끝까지 다 그린 뒤에 지운다. 입력 직후 버튼을 누르면 화면이 연달아 두 번 다시 그려지는데,
# 앞의 것이 중간에 끊기더라도 알림이 사라지지 않게 하기 위해서다.
st.session_state.notice = None
