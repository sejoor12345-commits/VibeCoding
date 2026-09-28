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
├── .claude/skills/browser-check/SKILL.md  # Playwright MCP로 웹 앱을 실제 브라우저에서 눌러 보며 확인
├── .claude/skills/vibeindex/SKILL.md  # 외부 스킬 (github.com/vibeindex/skills). 프로젝트에 맞는 스킬·MCP·플러그인 추천
└── shopping-list/index.html  # 쇼핑 리스트 앱 (추가·삭제·체크). 파일 하나, 더블클릭으로 브라우저에서 실행
```

## `vibeindex` 스킬 (외부에서 받아 온 것)

- 원래 `npx vibeindex add vibeindex/skills --skill vibeindex`로 설치한다. 이 컨테이너에서는 설치 도구가 쓰는
  GitHub API가 막혀서(403) 저장소를 clone해 `SKILL.md`를 그대로 복사했다 (원본 커밋 `1955aab`). 내용은 고치지 않는다.
- `/vibeindex`(프로젝트 분석 후 추천), `/vibeindex search <검색어>`, `/vibeindex top`, `/vibeindex trending`.
- `vibeindex.ai`에 접속해야 동작한다. 사용자가 환경 네트워크 설정에서 허용해 두었다.

## Playwright 연결 (`playwright` 플러그인 대신)

- 클라우드 세션은 플러그인을 설치하지 않는다 (`/plugin` 없음, `enabledPlugins`도 무시). 공식 `playwright` 플러그인은
  MCP 서버 `@playwright/mcp` 하나뿐이라, 같은 서버를 **저장소 맨 위** `.mcp.json`에 직접 등록했다.
  클라우드 세션은 저장소 맨 위에서 시작하므로 `Study-06/` 안이 아니라 맨 위에 둔다 (예외).
  맨 위 `.claude/settings.json`의 `enabledMcpjsonServers`로 켜 둔다. 새 세션부터 불러와진다.
- 이 컨테이너에 맞춘 옵션: `--browser chromium --executable-path /opt/pw-browsers/chromium` (미리 깔린 Chromium),
  `--headless`, `--isolated`, 버전 `0.0.82` 고정. 로컬 PC에서 쓸 때는 `--executable-path`를 지우면 된다.
- `file://` 주소는 막혀 있다. 앱은 `python3 -m http.server 8765 --directory <앱 폴더>`로 띄우고
  `http://localhost:8765/`로 연다. 스크린샷 등 기록은 `.playwright-mcp/`에 생기고 `.gitignore`에 들어 있다.
- `browser-check` 스킬이 확인 순서를 담고 있고, `auto-review`는 웹 화면을 리뷰할 때 이 스킬을 따른다.

## `auto-review` 스킬 규칙

- 리뷰는 **읽기 전용**이다. 보고서를 보여준 뒤 사용자가 "고쳐줘"라고 할 때만 고친다.
- `allowed-tools`는 읽기 도구, `git diff/status/log`, 문법 검사(`python3 -m py_compile`, `node --check`),
  브라우저 확인(`python3 -m http.server`, `mcp__playwright__*`)만 허락 없이 쓰게 해 둔 목록이다. 도구를 늘릴 때는 사용자에게 먼저 묻는다.
- 스킬 이름은 Claude Code 기본 제공 `/code-review`와 겹치지 않게 `auto-review`로 했다.
- 스킬은 이 폴더(`Study-06/`)를 작업 디렉터리로 열었을 때 불러와진다 (`.claude/commands/`와 같음).
- 연습용 예제 코드는 따로 만들지 않는다. 리뷰는 실제 코드(`shopping-list/` 등)에 쓴다.

## `shopping-list/` 앱 규칙

- `index.html` 한 파일 (HTML+CSS+JS 인라인, 외부 라이브러리 없음). 인터넷 없이 더블클릭만으로 열려야 한다.
- 목록은 `localStorage`의 `shopping-list-items` 키에 저장한다 (새로고침해도 유지).
- 계산 함수(`addItem`, `removeItem`, `toggleItem`, `removeDoneItems`)는 목록을 받아 새 목록을 돌려주고 화면을
  건드리지 않는다. 화면은 `render()`만 그린다. 사용자 입력은 항상 `textContent`로 넣는다.
- 브라우저 확인은 `browser-check` 스킬(Playwright MCP)로 한다. MCP가 없으면 Node Playwright(`/opt/node22/lib/node_modules/playwright`).
