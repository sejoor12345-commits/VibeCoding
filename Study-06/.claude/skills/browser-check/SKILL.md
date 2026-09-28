---
name: browser-check
description: Playwright MCP(브라우저 자동 조종 도구)로 웹 앱을 실제 브라우저에서 열어 버튼을 누르고 입력해 보며 제대로 동작하는지 확인한다. 사용자가 "브라우저에서 확인해줘", "실행해 봐", "눌러 봐", "화면 보여줘", "스크린샷"이라고 하거나, HTML/JS 웹 앱을 새로 만들거나 고친 뒤, auto-review가 웹 화면을 리뷰할 때 사용한다.
allowed-tools: Read, Glob, Bash(python3 -m http.server:*), Bash(pkill -f http.server:*), mcp__playwright__*
---

# 브라우저로 직접 확인하기

`playwright` MCP 서버(저장소 맨 위 `.mcp.json`)의 `mcp__playwright__browser_*` 도구로 웹 앱을 실제로 써 본다.
Claude Code 공식 `playwright` 플러그인과 같은 서버다. 클라우드 세션은 플러그인을 설치하지 않아서
`.mcp.json`으로 직접 연결해 두었다.

## 0단계: 도구가 있는지 확인

`mcp__playwright__browser_navigate` 같은 도구가 없으면 멈추고 사용자에게 알린다:
"Playwright 연결은 세션을 시작할 때 불러와져요. 새 세션을 열어 주세요."
(대신 Node Playwright 스크립트를 쓸 수는 있지만, 그때는 그렇다고 밝힌다.)

## 1단계: 앱을 로컬 서버로 열기

`file://` 주소는 보안 때문에 막혀 있다. 모든 파일 접근을 여는 옵션(`--allow-unrestricted-file-access`)은 쓰지 않는다.
대신 앱 폴더를 작은 웹 서버로 연다 (Colab에서 앱을 여는 방식과 같다).

```bash
python3 -m http.server 8765 --directory <앱 폴더>   # 예: Study-06/shopping-list (백그라운드로 실행)
```

그다음 `browser_navigate`로 `http://localhost:8765/`를 연다.

## 2단계: 사용자처럼 써 보기

- `browser_snapshot`으로 화면 구조를 읽고, 거기 나온 요소를 `browser_click`, `browser_type`, `browser_press_key`로 조작한다
- 그 앱의 `CLAUDE.md`나 `PRD*.md`에 적힌 기능을 하나씩 해 본다. 쇼핑 리스트라면:
  추가 → 체크 → 삭제 → 새로고침 후에도 남는지 → 빈칸 추가가 막히는지 → `<b>태그</b>` 입력이 글자 그대로 보이는지
- 휴대폰 화면도 본다: `browser_resize`로 폭 390px
- `browser_console_messages`로 오류(빨간 글씨)가 없는지 확인한다
- 필요하면 `browser_take_screenshot`으로 화면을 찍어 사용자에게 보여 준다
- 테스트로 넣은 데이터는 끝나고 지운다. 가명(A, B, C)이나 흔한 물건 이름만 쓴다

## 3단계: 정리

- 끝나면 `browser_close`로 브라우저를 닫고 `pkill -f "http.server 8765"`로 서버를 끈다
- 결과를 한국어로 짧게 보고한다:

```
## 브라우저 확인 결과: <앱 이름>
- ✅ 된 것: 추가, 체크, ...
- ❌ 안 된 것: 무엇을 했더니 → 어떻게 됐는지 (기대: ...)
- 콘솔 오류: 없음 / 있음(내용)
```
