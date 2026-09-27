# Study-04 백업 (20260927-194301, 한국 시간)

Study-04 마무리 시점의 전체 상태를 복사해 둔 것이다. 이 폴더의 파일은 **고치지 않는다** (기록용).
원본 커밋: `36cd35f` (브랜치 `claude/busy-sagan-b2yuio`)

## 이 시점의 상태
- 냉장고 사진 → 재료 인식 → 레시피 추천 → 프로필/레시피 저장까지 1~3단계 완성 (Streamlit 앱)
- 사용 모델: 재료 인식 `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`,
  레시피 생성 `stealth/space-bunny-alpha`
- code-reviewer → performance-optimizer → ux-designer 순서로 검토·개선을 마친 상태
- 남은 결정: AI를 기다리는 동안 다른 칸을 건드리면 결과가 사라지는 문제는 경고 문구만 넣어 둠

## 들어 있는 것
| 파일 | 원래 위치 |
|---|---|
| `fridge_recipe/*.py` | `Study-04/fridge_recipe/` (앱 코드 5개) |
| `PRD_step1~3.md`, `CLAUDE.md`, `api_test.py`, `.gitignore`, `.env.example` | `Study-04/` |
| `agents/*.md` | `Study-04/.claude/agents/` (서브에이전트 3개) |

들어 있지 않은 것: API 키(원래 코드에 없음), 프로필·레시피 저장 데이터(Google Drive의 `fridge_recipe_data/`),
`__pycache__`, `streamlit.log`.

## 되돌리는 방법 (Colab)
앱 코드를 이 백업으로 되돌리려면:
```python
%cd /content/VibeCoding/Study-04
!cp backups/20260927-194301/fridge_recipe/*.py fridge_recipe/
```
