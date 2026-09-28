# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 폴더 개요

`Study-06`은 "혼자 공부하는 바이브코딩 with 클로드 코드"의 **스킬(Skill)** 실습 폴더다 (저장소 맨 위:
`VibeCoding/`). 스킬은 Claude가 특정 일을 할 때 따르는 설명서 묶음으로, 커스텀 명령어와 달리 `/이름`으로
부르지 않아도 사용자의 말이 스킬 설명(`description`)과 맞으면 Claude가 **알아서** 꺼내 쓴다.

## 구조

```
Study-06/
├── .claude/skills/auto-review/
│   ├── SKILL.md            # 스킬 본문: 이름·설명(언제 쓰는지)·허용 도구 + 리뷰 4단계 절차
│   ├── checklist.md        # 점검표 (보안 > 버그 > 코딩 규칙 > 성능). SKILL.md가 필요할 때 읽음
│   └── report-template.md  # 한국어 보고서 형식
```

## `auto-review` 스킬 규칙

- 리뷰는 **읽기 전용**이다. 보고서를 보여준 뒤 사용자가 "고쳐줘"라고 할 때만 고친다.
- `allowed-tools`는 읽기 도구와 `git diff/status/log`, 문법 검사(`python3 -m py_compile`, `node --check`)만
  허락 없이 쓰게 해 둔 목록이다. 도구를 늘릴 때는 사용자에게 먼저 묻는다.
- 스킬 이름은 Claude Code 기본 제공 `/code-review`와 겹치지 않게 `auto-review`로 했다.
- 스킬은 이 폴더(`Study-06/`)를 작업 디렉터리로 열었을 때 불러와진다 (`.claude/commands/`와 같음).
- 연습용 예제 코드는 따로 만들지 않는다. 리뷰는 다른 `Study-NN/` 폴더의 실제 코드에 쓴다.
