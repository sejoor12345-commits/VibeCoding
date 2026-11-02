# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 폴더 개요

`Study-07`은 책 실습이 아니라 사용자(류지웅)의 약점 "직접 고치기 · 디버깅"을 위한 **디버깅 도장**이다 (저장소 맨 위: `VibeCoding/`).
사용자의 진짜 코드(Iwillbecomemonster · ai-yearend · timetable-ai · auto-starting-program)에서 작은 함수를 잘라
혼자 돌아가게 만든 버그 문제 25개. 사용법 · 문제 목록 · 새 문제 틀은 `README.md`.

## 구조

```
Study-07/
├── README.md               # 사용자용: 하루 10분 쓰는 법, 문제 목록, 새 문제 틀, 다음 단계
└── debug-dojo/
    ├── index.html          # 앱 전체 한 파일 (HTML+CSS+JS 인라인, 외부 파일 없음, 인터넷 없이 더블클릭으로 열림)
    ├── verify.mjs          # Node Playwright 확인: 문제마다 버그 ✗ · 정답 ✓, 화면 흐름, 390px, 스크린샷
    └── .gitignore          # shots/ (verify.mjs 기본 스크린샷 폴더)
```

## `index.html` 규칙

- 문제 코드는 `<script type="text/plain" data-ex="<id>" data-part="bug|fix|prelude">` 덩어리로 둔다 (따옴표 · 백틱을 이스케이프하지 않으려고).
  설명 · 테스트는 `const EXERCISES = [...]`. 순서 = 난이도 순(★1 → ★3). **처음 5문제는 한 줄 고치기**.
- 테스트: `{ name, run: '식', expect: 값 }`. `run`은 문제 코드와 같은 범위에서 `eval`된다. 테스트마다 코드를 새로 실행해서 서로 영향이 없다.
  비교는 `dojoSame`(깊은 비교, NaN끼리 같음). 결과의 글자는 항상 따옴표를 붙여 보여 준다(글자 vs 숫자 구분).
- 실행기: `runSuite`를 Blob **Web Worker**에서 돌리고 테스트 하나가 `TIME_LIMIT`(2초)를 넘으면 워커를 끝낸다(무한 반복 보호).
  워커를 못 만들면 페이지 안(`inline`)에서 돈다(보호 없음). `new Function` + `eval`은 이 앱의 목적이라 일부러 쓴다(주석 있음).
- `real.kind`: `fixed`(실제로 일어나서 고침) · `live`(지금 앱에 남아 있음) · `notes`(복습 노트·실제 코드에서 나온 것) · `whatif`(가상).
  **가상을 실제 사건처럼 쓰지 않는다.** live/fixed는 커밋 해시나 확인 날짜를 적는다.
- 저장: `localStorage` 키 `debug-dojo-v1` (모든 접근 try/catch, 막혀도 동작 + 안내). 사지방 PC 초기화 대비로 도감에 "진행 기록 옮기기"(JSON 복사/붙여넣기).
- 날짜는 `localDay()`(기기 시간대). `toISOString().slice(0, 10)` 금지 — 22번 문제가 바로 그 버그.
- 화면 글은 존댓말. 색은 `:root` 토큰 + 다크 모드(`prefers-color-scheme` + `data-theme`), 390px에서 가로 넘침 없음, 버튼 44px 이상.
- 사용자 입력(메모 · 예상 · 코드)은 `.value` / `textContent`로만 넣는다. 템플릿에 넣는 값은 `esc()`.

## 확인

- `NODE_PATH=/opt/node22/lib/node_modules node Study-07/debug-dojo/verify.mjs <스크린샷 폴더>` — 문제를 고치거나 추가하면 꼭 돌린다.
  `file://`로 열어서 워커가 실제로 도는지도 본다. 시간대는 `Asia/Seoul`로 맞춘다.
- 출처 저장소는 **읽기만** 한다. 문제를 만들려고 그 저장소 코드를 고치지 않는다.

## 사용자에게 설명할 때

- 사용자가 직접 고칠 수 있는 1~2줄 버그는 Claude가 고치지 않고 위치만 알려 준다 (Iwillbecomemonster `docs/owner-fixes.md`와 같은 규칙).
- 버그 이야기를 할 때 "디버깅 5단계"(재현 → 범위 좁히기 → 가설 → 한 가지만 바꾸기 → 확인) 말을 같이 쓴다.
- Python 비유를 붙인다 (`print` = `console.log`, `breakpoint()` = `debugger;`, `x or d` vs `??` 등).
