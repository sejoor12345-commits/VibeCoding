# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-03` is a general-knowledge quiz game (상식 퀴즈 게임), from working through "혼자 공부하는
바이브코딩 with 클로드 코드" (repo root: `VibeCoding/`), alongside `Study-01/`, `Study-02/`. No build
step, no framework — plain HTML/CSS/JavaScript.

Current state: mode select → (mode-specific setup) → sequential quiz with answer checking → result screen
(score + leaderboard) → leaderboard screen. The three modes (see **Game modes**) all share the same quiz
screen and scoring; they only differ in how `state.list` gets built and, for 스피드 퀴즈, in a per-question
countdown. Picking a choice immediately colors it correct (green) or wrong (red), highlights the correct
choice, shows a "정답입니다!"/"오답입니다!" banner and the question's `explanation`, then auto-advances
after `AUTO_ADVANCE_MS` (or immediately on a manual "다음 문제" click). After the quiz's last question, a
result screen shows the total score (see **Scoring** below), accuracy, max combo, and hints used, asks
for a nickname (every single time, since the same shared PC can have different people playing — the input
is just prefilled with whoever typed last), records the play in `localStorage`, and offers "리더보드 보기"
(top 10 by score, filterable by mode — see **Game modes**), a mode-appropriate retry, or "처음으로" back
to mode selection.

## Game modes

Selected on `#screen-mode` (`MODES`, the very first screen now — `state.mode` is one of `"category"` |
`"all"` | `"speed"` and drives every mode-dependent branch below):

- **카테고리별** (`startCategoryQuiz`) — unchanged from before modes existed: pick 1 category on
  `#screen-start`, then 1 difficulty on `#screen-difficulty`; `state.list` is that category+difficulty's
  10 questions in file order.
- **전체 도전** (`startAllChallengeQuiz`) — skips category selection, goes straight from mode-select to
  `#screen-difficulty` (`goToDifficultyScreen()` checks `state.mode === "all"` to skip the category-specific
  title/count and go category-less); picking a difficulty builds `state.list` from `buildAllChallengeList()`:
  that difficulty's 10 questions from *each* of the 4 categories (40 total), concatenated and then run
  through `shuffle()` (Fisher-Yates). Shuffled rather than left grouped by category on purpose — grouped
  blocks of 10 would just feel like doing "카테고리별" four times in a row back-to-back, which defeats the
  point of a distinct "전체 도전" mode; shuffling keeps the category unpredictable question-to-question,
  which makes the existing combo bonus (see **Scoring**) actually matter and keeps a 40-question run from
  feeling repetitive. If a strictly sequential (grouped-by-category) order is ever wanted instead, drop the
  `shuffle()` call in `buildAllChallengeList()`.
- **스피드 퀴즈** (`startSpeedQuiz`) — skips both category and difficulty selection entirely; `state.list`
  is `buildSpeedList()`: the *entire* 160-question pool shuffled and sliced to `SPEED_QUESTION_COUNT` (20),
  so both category and difficulty vary question-to-question. Every question gets a hard 15s
  (`SPEED_TIME_LIMIT_SECONDS`) countdown shown big in `#speed-timer` (`startSpeedCountdown()`, ticking via
  `state.speedTimerInterval`); hitting 0 while unanswered calls `handleTimeout()`, which scores it as a
  wrong answer (see **Scoring**) with no choice highlighted red (nothing was actually clicked) and a
  "시간 초과" banner, then auto-advances exactly like a normal answer. `getEffectiveTimeLimitSeconds()` is
  the single place that decides "which time limit applies right now" — `SPEED_TIME_LIMIT_SECONDS` in speed
  mode, else `current.timeLimit || DEFAULT_TIME_LIMIT_SECONDS` — and it's used both for that visible
  countdown and for the scoring time-bonus threshold, so a speed-mode question's fast-answer cutoff is
  7.5s (half of 15s), not the normal 5s.

`retryCurrentMode()` re-runs whichever mode is current with the same parameters (same category+difficulty,
same all-challenge difficulty, or a freshly-shuffled new speed set); the result screen's retry button label
changes to match (`renderResult()`).

## Scoring

Per-question score (0 if the answer is wrong — no bonuses apply): `BASE_SCORE (10) x DIFFICULTY_MULTIPLIER
+ timeBonus + hintBonus + comboBonus`, computed in `calculateQuestionScore()`.

- **Difficulty multiplier** (`DIFFICULTY_MULTIPLIER`): 하 x1.0, 중 x1.2, 상 x1.5, 최상 x2.0.
- **Time bonus** (`TIME_BONUS_POINTS`, +5): awarded when the answer comes within half of the question's
  effective time limit, from `getEffectiveTimeLimitSeconds()` — `current.timeLimit` (seconds, optional per
  question; none set yet, so this falls back to `DEFAULT_TIME_LIMIT_SECONDS`, 10s) normally, or the fixed
  `SPEED_TIME_LIMIT_SECONDS` (15s) in 스피드 퀴즈. Timed from `state.questionStartTime` (set in
  `renderQuestion()`) to the answer, whether that's a click (`selectChoice()`) or a 스피드 퀴즈 timeout
  (`handleTimeout()` — always 0 bonus in practice, since answering exactly at the limit is never within
  half of it).
- **Hint bonus** (`HINT_BONUS_POINTS`, +3): only questions with `hasHint: true` are eligible at all; you
  get it when you *don't* click the hint button for that question. `useHint()` removes one wrong choice
  (`.hint-hidden`, one use per question) and cancels this bonus for that question only.
- **Combo bonus** (`COMBO_BONUS_POINTS`, +5): added on top of the base score every time `state.combo`
  (consecutive correct answers) hits a multiple of `COMBO_STREAK` (3) — so +5 at 3, another +5 at 6, etc.
  A wrong answer resets `state.combo` to 0 (and itself scores 0).

`state.totalScore` accumulates every question's score for the result screen; `state.maxCombo` and
`state.hintsUsedCount` are tracked separately purely for the result screen's stats line and are not saved
to `localStorage` records (those still only store the final `score`/`accuracy`). Every answered question
logs its full breakdown to the browser console (see **Verifying the scoring**).

## Files

- **`questions.js`** — the question bank. A single global array `questions`, loaded via a plain
  `<script>` tag (no modules, no bundler). 160 questions: 4 categories (한국사, 과학, 일반상식, 의학) x 4
  difficulties (하=초등학생, 중=고등학생, 상=대학생, 최상=그 분야를 공부하는 사람) x 10 questions each. Each
  entry: `{ id, category, difficulty, hasHint, question, choices[4], answerIndex, explanation }`.
  `hasHint` is `true` for 하/중/상 and `false` for every 최상 question (expert-tier questions get no hint
  button at all) — an editorial choice, not something the game logic requires; set it per-question if you
  want a different split. An optional `timeLimit` (seconds) can be added to any question to override the
  10s default used for the time bonus above.
- **`index.html`** — the whole app: markup, CSS, and the quiz logic, all in this one file (`questions.js`
  is loaded separately only because it's data, not app code). Six screens toggled by a `.active` class:
  `#screen-mode` (the initial screen; mode buttons built from `MODES`), `#screen-start` (category buttons,
  built from the `CATEGORIES` array; only reached from 카테고리별 mode, has its own "← 모드 선택으로" back
  button now that it's no longer the home screen), `#screen-difficulty` (difficulty buttons, built from
  `DIFFICULTIES`, each showing its question count; shared by 카테고리별 and 전체 도전 — see **Game modes**),
  `#screen-quiz` (progress counter, the conditional `#speed-timer` and `#hint-btn`, question text, choice
  list, the `#answer-banner`/`#explanation-text` pair shown after answering, "다음 문제"/"결과 보기"
  button), `#screen-result` (score, accuracy, the `#result-stats` line, the always-shown
  `#nickname-section`, and leaderboard/retry/back buttons), and `#screen-leaderboard` (filter tabs from
  `LEADERBOARD_FILTERS`, top-`LEADERBOARD_SIZE` list, "다시하기" back to mode select). `state` holds
  `mode`, the current category/difficulty (both `null` for modes where they don't apply — see **Game
  modes**), the filtered question list (`list`), the current index, `correctCount`, whether the current
  question has been `answered` (blocks further clicks and re-entrant auto-advance/speed timers), the
  pending `autoAdvanceTimer` and `speedTimerInterval` (both cleared on manual next/back so they can't fire
  after the user has already navigated elsewhere), `lastResult` (the just-finished play's
  mode/difficulty/score/accuracy, used once a nickname is submitted), `leaderboardFilter`, and the scoring
  fields described above (`totalScore`, `combo`, `maxCombo`, `hintsUsedCount`, `hintUsedThisQuestion`,
  `questionStartTime`).

  `localStorage` (see keys below) holds the last-used nickname (prefill convenience only, since the game
  now asks every time) and each nickname's best score, scoped to whichever browser/device it's opened in
  (not shared between people or devices — see below). `getLastNickname`/`setLastNickname`/`getRecords`/
  `saveRecords`/`recordResult` are the only functions touching it, each wrapped in `try/catch` since
  storage can be disabled (private browsing, locked-down shared PCs).

## localStorage keys

- `quiz:lastNickname` — plain string. Only used to prefill the nickname input for convenience; saving a
  play always asks for (and records) whatever name is currently typed, not just the first time.
- `quiz:records` — JSON-encoded array of `{ nickname, mode, difficulty, score, accuracy, date }`. `mode` is
  the human-readable value from `getRecordModeValue()` — a category name for 카테고리별, `"전체"` for 전체
  도전, `"스피드"` for 스피드 퀴즈— not the internal `state.mode` enum; it's what the leaderboard filter
  tabs match against. `difficulty` is `null` for 스피드 퀴즈 (`getRecordDifficultyValue()`), since each of
  its 20 questions can be a different tier. At most one entry per `(nickname, mode, difficulty)` triple:
  `recordResult()` only overwrites it when the new score is strictly higher, so this is each player's
  personal best per mode+difficulty, not a full play history. `date` is `new Date().toISOString()`; the UI
  only ever shows the `YYYY-MM-DD` slice.
  This schema replaced an older `{ nickname, category, difficulty, ... }` shape (no `mode` field, one
  entry per category+difficulty) when game modes were added — any leftover old-shape entries in a
  browser's `localStorage` won't match any leaderboard filter's `r.mode` check and will show up with a
  blank mode label under "모두"; clear them with `localStorage.clear()` in the console if that's confusing.

localStorage is per-browser-profile and per-origin — it lives on whichever device's browser rendered the
page, not "in the cloud" or in a shared place, so different people's nicknames on different devices never
actually get compared against each other; the leaderboard only ever reads what that one browser has saved
locally. Opened as a `file://` page directly, that's the machine running the browser. Opened through a
Colab port-forward (`serve_kernel_port_as_window`/`_iframe`), it's still the viewer's own physical browser
storing it — Colab's Python runtime never sees it — but the forwarded URL is tied to that specific Colab
session, so a new session (after a runtime restart) gets a new URL and the old localStorage entries won't
show up under it.

## Verifying the scoring

`answerQuestion()` — reached from a click (`selectChoice()`) or a 스피드 퀴즈 timeout (`handleTimeout()`) —
logs one line per answered question to the browser console (F12 → Console) with every term of the formula:
difficulty multiplier, time/hint/combo bonus, that question's score, the running combo, and the cumulative
total (plus a "(시간 초과)" marker when it was a timeout, not a click), so a run's final score can be
checked by hand against the log instead of just trusting the number on the result screen.

## How to run it

No server or build needed — open `Study-03/index.html` directly in a browser (double-click, or drag the
file into a browser tab). It loads `questions.js` next to it with a relative `<script src="questions.js">`
path, so keep both files in the same folder.

## 퀴즈 문제 교차 검증 가이드라인

모든 문제 작성 시 확인 사항
1. 정답이 하나뿐인가?
  - 다른 해석 가능 시 조건 명시 (예: 면적 기준, 2024년 기준)
2. 최상급 표현에 기준이 있는가?
  - '가장 큰', '최초의' 등 표현에 측정 기준 명시
3. 시간과 범위가 명확한가?
  - 변할 수 있는 정보는 시점 병시
  - 지리적, 분류적 범위 한정
4. 교차 검증했는가?
  - 의심스러운 정보는 2개 이상 출처 확인
  - 논란 있는 내용은 주류 학설기준
