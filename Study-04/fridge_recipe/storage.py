"""3단계: 프로필과 저장한 레시피를 JSON 파일(profiles.json) 하나에 읽고 쓴다. AI는 쓰지 않는다."""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path

DATA_FILE_NAME = "profiles.json"
MAX_NICKNAME_LENGTH = 20

DIET_OPTIONS = ["제한 없음", "채식", "비건", "저탄수화물"]
SKILL_OPTIONS = ["초보", "보통", "능숙"]
DEFAULT_SERVINGS = 2


class ProfileError(Exception):
    """화면에 그대로 보여줘도 되는 안내 문구를 담은 오류."""


# 파일을 읽거나 쓰다가 실패했을 때(예: Colab에서 Google Drive 연결이 끊김) 보여줄 안내 문구
FILE_ERROR_MESSAGE = "저장 데이터를 읽거나 쓰지 못했어요. Google Drive 연결을 확인해주세요."


def get_data_dir():
    """데이터 폴더. 환경 변수 RECIPE_DATA_DIR가 있으면 그곳(Colab에서는 Google Drive), 없으면 fridge_recipe/data."""
    return Path(os.environ.get("RECIPE_DATA_DIR") or Path(__file__).parent / "data")


def empty_data():
    return {"version": 1, "profiles": {}}


def now_text():
    return datetime.now().isoformat(timespec="seconds")


def load_data():
    """저장 데이터를 읽어 돌려준다. 파일이 없으면 빈 데이터.

    파일을 읽지 못하면 ProfileError를 낸다. 파일이 손상됐으면 원본을 옮겨두고 ProfileError를 내므로,
    그다음에 부르면 빈 데이터로 시작한다.
    """
    path = get_data_dir() / DATA_FILE_NAME
    try:
        if not path.exists():
            return empty_data()
        text = path.read_text(encoding="utf-8")
    except OSError:  # 잠깐 읽지 못한 것일 수 있으니 멀쩡할지도 모르는 파일을 옮기지 않는다
        raise ProfileError(FILE_ERROR_MESSAGE)

    try:
        data = json.loads(text)
        if not isinstance(data, dict) or not isinstance(data.get("profiles"), dict):
            raise ValueError("profiles가 없음")
        return data
    except ValueError:
        # 손상된 원본은 지우지 않고 따로 보관한다. 이름에 시간을 붙여 예전 백업을 덮어쓰지 않게 한다
        backup_name = f"profiles.corrupt-{datetime.now():%Y%m%d-%H%M%S}.json"
        try:
            os.replace(path, path.with_name(backup_name))
        except OSError:
            raise ProfileError(FILE_ERROR_MESSAGE)
        raise ProfileError(f"저장 데이터를 읽지 못해 새로 시작했어요. (원래 파일은 {backup_name}으로 보관했어요)")


def save_data(data):
    """임시 파일에 먼저 쓴 뒤 바꿔치기한다. 저장 도중 끊겨도 기존 파일이 깨지지 않는다."""
    data_dir = get_data_dir()
    temp_path = data_dir / (DATA_FILE_NAME + ".tmp")
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        temp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp_path, data_dir / DATA_FILE_NAME)
    except OSError:
        raise ProfileError(FILE_ERROR_MESSAGE)


def get_profile(nickname):
    """닉네임에 해당하는 프로필을 돌려준다. 없으면 None."""
    return load_data()["profiles"].get(nickname)


def create_profile(nickname):
    """새 프로필을 만들고 정리된 닉네임을 돌려준다."""
    nickname = nickname.strip()
    if not nickname:
        raise ProfileError("닉네임을 입력해주세요.")
    if len(nickname) > MAX_NICKNAME_LENGTH:
        raise ProfileError(f"닉네임은 {MAX_NICKNAME_LENGTH}자 이하로 써주세요.")

    data = load_data()
    if nickname in data["profiles"]:
        raise ProfileError("이미 있는 닉네임이에요.")

    data["profiles"][nickname] = {
        "nickname": nickname,
        "allergies": [],
        "dislikes": [],
        "diet": DIET_OPTIONS[0],
        "skill": SKILL_OPTIONS[0],
        "default_servings": DEFAULT_SERVINGS,
        "created_at": now_text(),
        "saved_recipes": [],
    }
    save_data(data)
    return nickname


def update_profile(nickname, allergies, dislikes, diet, skill, default_servings):
    """프로필 정보(알레르기, 싫어하는 재료, 식단, 실력, 기본 인분)를 바꿔 저장한다."""
    data = load_data()
    profile = data["profiles"].get(nickname)
    if profile is None:
        raise ProfileError("프로필을 찾을 수 없어요.")

    profile.update({
        "allergies": allergies,
        "dislikes": dislikes,
        "diet": diet,
        "skill": skill,
        "default_servings": default_servings,
    })
    save_data(data)


def save_recipe(nickname, recipe, source_ingredients):
    """레시피를 프로필에 저장한다. 같은 제목이 이미 있으면 ProfileError."""
    data = load_data()
    profile = data["profiles"].get(nickname)
    if profile is None:
        raise ProfileError("먼저 프로필을 선택해주세요.")
    if any(saved["recipe"]["title"] == recipe["title"] for saved in profile["saved_recipes"]):
        raise ProfileError("이미 저장된 레시피예요.")

    profile["saved_recipes"].append({
        "id": uuid.uuid4().hex,
        "saved_at": now_text(),
        "source_ingredients": list(source_ingredients),
        "recipe": recipe,  # 2단계 레시피를 고치지 않고 그대로 넣는다
    })
    save_data(data)


def delete_recipe(nickname, recipe_id):
    data = load_data()
    profile = data["profiles"].get(nickname)
    if profile is None:
        return
    profile["saved_recipes"] = [saved for saved in profile["saved_recipes"] if saved["id"] != recipe_id]
    save_data(data)
