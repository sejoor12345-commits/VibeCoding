"""3단계: 프로필과 저장한 레시피를 JSON 파일(profiles.json) 하나에 읽고 쓴다. AI는 쓰지 않는다."""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path

DATA_FILE_NAME = "profiles.json"
CORRUPT_FILE_NAME = "profiles.corrupt.json"
MAX_NICKNAME_LENGTH = 20

DIET_OPTIONS = ["제한 없음", "채식", "비건", "저탄수화물"]
SKILL_OPTIONS = ["초보", "보통", "능숙"]
DEFAULT_SERVINGS = 2


class ProfileError(Exception):
    """화면에 그대로 보여줘도 되는 안내 문구를 담은 오류."""


def get_data_dir():
    """데이터 폴더. 환경 변수 RECIPE_DATA_DIR가 있으면 그곳(Colab에서는 Google Drive), 없으면 fridge_recipe/data."""
    return Path(os.environ.get("RECIPE_DATA_DIR") or Path(__file__).parent / "data")


def empty_data():
    return {"version": 1, "profiles": {}}


def now_text():
    return datetime.now().isoformat(timespec="seconds")


def load_data():
    """(데이터, 손상 여부)를 돌려준다. 파일이 없으면 빈 데이터, 손상됐으면 원본을 옮겨두고 빈 데이터."""
    path = get_data_dir() / DATA_FILE_NAME
    if not path.exists():
        return empty_data(), False

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("profiles"), dict):
            raise ValueError("profiles가 없음")
        return data, False
    except (ValueError, OSError):
        os.replace(path, path.with_name(CORRUPT_FILE_NAME))  # 손상된 원본은 지우지 않고 따로 보관한다
        return empty_data(), True


def save_data(data):
    """임시 파일에 먼저 쓴 뒤 바꿔치기한다. 저장 도중 끊겨도 기존 파일이 깨지지 않는다."""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    temp_path = data_dir / (DATA_FILE_NAME + ".tmp")
    temp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp_path, data_dir / DATA_FILE_NAME)


def get_profile(nickname):
    """닉네임에 해당하는 프로필을 돌려준다. 없으면 None."""
    data, _ = load_data()
    return data["profiles"].get(nickname)


def list_nicknames():
    data, _ = load_data()
    return sorted(data["profiles"])


def create_profile(nickname):
    """새 프로필을 만들고 정리된 닉네임을 돌려준다."""
    nickname = nickname.strip()
    if not nickname:
        raise ProfileError("닉네임을 입력해주세요.")
    if len(nickname) > MAX_NICKNAME_LENGTH:
        raise ProfileError(f"닉네임은 {MAX_NICKNAME_LENGTH}자 이하로 써주세요.")

    data, _ = load_data()
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
    data, _ = load_data()
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
    data, _ = load_data()
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
    data, _ = load_data()
    profile = data["profiles"].get(nickname)
    if profile is None:
        return
    profile["saved_recipes"] = [saved for saved in profile["saved_recipes"] if saved["id"] != recipe_id]
    save_data(data)
