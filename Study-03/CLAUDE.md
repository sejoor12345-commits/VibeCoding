# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-03` is a general-knowledge quiz game (상식 퀴즈 게임), from working through "혼자 공부하는
바이브코딩 with 클로드 코드" (repo root: `VibeCoding/`), alongside `Study-01/`, `Study-02/`. No build
step, no framework — plain HTML/CSS/JavaScript.

Current state: category select → sequential quiz with answer checking → result screen. Picking a choice
immediately colors it correct (green) or wrong (red) and also highlights the correct choice, then
auto-advances after `AUTO_ADVANCE_MS` (or immediately on a manual "다음 문제" click). After the category's
last question, a result screen shows score (correct count x `POINTS_PER_QUESTION`) and accuracy, with
options to retry the same category or go back to category selection. `explanation` in `questions.js` is
still unused — showing it alongside the color feedback is a natural next step.

## Files

- **`questions.js`** — the question bank. A single global array `questions`, loaded via a plain
  `<script>` tag (no modules, no bundler). 40 questions: 4 categories (한국사, 과학, 일반상식, 의학) x 10
  questions each. Each entry: `{ id, category, question, choices[4], answerIndex, explanation }`.
- **`index.html`** — the whole app: markup, CSS, and the quiz logic, all in this one file (`questions.js`
  is loaded separately only because it's data, not app code). Three screens toggled by a `.active` class:
  `#screen-start` (category buttons, built from the `CATEGORIES` array), `#screen-quiz` (progress
  counter, question text, choice list, "다음 문제"/"결과 보기" button), and `#screen-result` (score,
  accuracy, retry/back buttons). `state` holds the current category, the filtered 10-question list, the
  current index, `correctCount`, whether the current question has been `answered` (blocks further clicks
  and re-entrant auto-advance timers), and the pending `autoAdvanceTimer` (cleared on manual next/back so
  it can't fire after the user has already navigated elsewhere).

## How to run it

No server or build needed — open `Study-03/index.html` directly in a browser (double-click, or drag the
file into a browser tab). It loads `questions.js` next to it with a relative `<script src="questions.js">`
path, so keep both files in the same folder.
