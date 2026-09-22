# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-03` is a general-knowledge quiz game (상식 퀴즈 게임), from working through "혼자 공부하는
바이브코딩 with 클로드 코드" (repo root: `VibeCoding/`), alongside `Study-01/`, `Study-02/`. No build
step, no framework — plain HTML/CSS/JavaScript.

Current state: category select → difficulty select → sequential quiz with answer checking → result screen
(score + leaderboard) → leaderboard screen. Picking a choice immediately colors it correct (green) or
wrong (red), highlights the correct choice, shows a "정답입니다!"/"오답입니다!" banner and the question's
`explanation`, then auto-advances after `AUTO_ADVANCE_MS` (or immediately on a manual "다음 문제" click).
After the category+difficulty's last question, a result screen shows score (correct count x
`POINTS_PER_QUESTION`) and accuracy, asks for a nickname (every single time, since the same shared PC can
have different people playing — the input is just prefilled with whoever typed last), records the play in
`localStorage`, and offers "리더보드 보기" (top 10 by score, filterable by category), retry (same
category+difficulty), or back to category selection.

## Files

- **`questions.js`** — the question bank. A single global array `questions`, loaded via a plain
  `<script>` tag (no modules, no bundler). 160 questions: 4 categories (한국사, 과학, 일반상식, 의학) x 4
  difficulties (하=초등학생, 중=고등학생, 상=대학생, 최상=그 분야를 공부하는 사람) x 10 questions each. Each
  entry: `{ id, category, difficulty, question, choices[4], answerIndex, explanation }`.
- **`index.html`** — the whole app: markup, CSS, and the quiz logic, all in this one file (`questions.js`
  is loaded separately only because it's data, not app code). Five screens toggled by a `.active` class:
  `#screen-start` (category buttons, built from the `CATEGORIES` array), `#screen-difficulty` (difficulty
  buttons for the chosen category, built from `DIFFICULTIES`, each showing its question count), `#screen-quiz`
  (progress counter, question text, choice list, the `#answer-banner`/`#explanation-text` pair shown after
  answering, "다음 문제"/"결과 보기" button), `#screen-result` (score, accuracy, the always-shown
  `#nickname-section`, and leaderboard/retry/back buttons), and `#screen-leaderboard` (filter tabs from
  `LEADERBOARD_FILTERS`, top-`LEADERBOARD_SIZE` list, "다시하기" back to category select). `state` holds the
  current category/difficulty, the filtered 10-question list, the current index, `correctCount`, whether
  the current question has been `answered` (blocks further clicks and re-entrant auto-advance timers), the
  pending `autoAdvanceTimer` (cleared on manual next/back so it can't fire after the user has already
  navigated elsewhere), `lastResult` (the just-finished play's category/difficulty/score/accuracy, used
  once a nickname is submitted), and `leaderboardFilter`.

  `localStorage` (see keys below) holds the last-used nickname (prefill convenience only, since the game
  now asks every time) and each nickname's best score, scoped to whichever browser/device it's opened in
  (not shared between people or devices — see below). `getLastNickname`/`setLastNickname`/`getRecords`/
  `saveRecords`/`recordResult` are the only functions touching it, each wrapped in `try/catch` since
  storage can be disabled (private browsing, locked-down shared PCs).

## localStorage keys

- `quiz:lastNickname` — plain string. Only used to prefill the nickname input for convenience; saving a
  play always asks for (and records) whatever name is currently typed, not just the first time.
- `quiz:records` — JSON-encoded array of `{ nickname, category, difficulty, score, accuracy, date }`. At
  most one entry per `(nickname, category, difficulty)` triple: `recordResult()` only overwrites it when
  the new score is strictly higher, so this is each player's personal best per category+difficulty, not a
  full play history. `date` is `new Date().toISOString()`; the UI only ever shows the `YYYY-MM-DD` slice.

localStorage is per-browser-profile and per-origin — it lives on whichever device's browser rendered the
page, not "in the cloud" or in a shared place, so different people's nicknames on different devices never
actually get compared against each other; the leaderboard only ever reads what that one browser has saved
locally. Opened as a `file://` page directly, that's the machine running the browser. Opened through a
Colab port-forward (`serve_kernel_port_as_window`/`_iframe`), it's still the viewer's own physical browser
storing it — Colab's Python runtime never sees it — but the forwarded URL is tied to that specific Colab
session, so a new session (after a runtime restart) gets a new URL and the old localStorage entries won't
show up under it.

## How to run it

No server or build needed — open `Study-03/index.html` directly in a browser (double-click, or drag the
file into a browser tab). It loads `questions.js` next to it with a relative `<script src="questions.js">`
path, so keep both files in the same folder.
