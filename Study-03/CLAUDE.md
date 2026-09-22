# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-03` is a general-knowledge quiz game (상식 퀴즈 게임), from working through "혼자 공부하는
바이브코딩 with 클로드 코드" (repo root: `VibeCoding/`), alongside `Study-01/`, `Study-02/`. No build
step, no framework — plain HTML/CSS/JavaScript.

Current state: category select screen → sequential question display for the chosen category. There is
no answer-checking or scoring yet; that's the next step.

## Files

- **`questions.js`** — the question bank. A single global array `questions`, loaded via a plain
  `<script>` tag (no modules, no bundler). 40 questions: 4 categories (한국사, 과학, 일반상식, 의학) x 10
  questions each. Each entry: `{ id, category, question, choices[4], answerIndex, explanation }`.
  `answerIndex` and `explanation` aren't used by the UI yet — they're there for the answer-check/feedback
  step that comes next.
- **`index.html`** — the whole app: markup, CSS, and the quiz logic, all in this one file (`questions.js`
  is loaded separately only because it's data, not app code). Two screens toggled by a `.active` class:
  `#screen-start` (category buttons, built from the `CATEGORIES` array) and `#screen-quiz` (progress
  counter, question text, choice list, "다음 문제"/"처음으로" button). `state` holds the current category,
  the filtered 10-question list, and the current index.

## How to run it

No server or build needed — open `Study-03/index.html` directly in a browser (double-click, or drag the
file into a browser tab). It loads `questions.js` next to it with a relative `<script src="questions.js">`
path, so keep both files in the same folder.
