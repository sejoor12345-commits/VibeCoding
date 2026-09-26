# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-02` is a todo app (할 일 관리 앱), from working through "혼자 공부하는 바이브코딩 with 클로드 코드"
(repo root: `VibeCoding/`). No build step, no framework, no dependencies: plain HTML/CSS/JavaScript,
data kept in the browser's `localStorage`. There is no test suite or linter.

Features: add/edit/delete todos, 3 categories (`work` 업무 / `personal` 개인 / `study` 공부), done and
important flags, category/status/important-only filters, search, 7 sort modes, drag-and-drop and Alt+Arrow
reordering, delete with undo toast, "어제까지 끝낸 항목 정리" cleanup, JSON export/import (merge or
replace), keyword-based auto-classification while typing, light/dark theme, daily quote, animated progress
bar with confetti, keyboard shortcuts (`n` new, `/` search, `?` help, `Esc` close).

## Two copies of the app

- **`todo-app/`**: the original, mobile-first single-column layout.
- **`todo-app/web_version/`**: a copy of the same app that adds a desktop layout. Only `style.css`
  differs: an extra `@media (min-width: 960px)` block at the end turns `.page` into a 2-column grid
  (sidebar: quote/progress/input/filters; main: list controls + an independently scrolling list).
  `index.html` and `app.js` are byte-identical to the originals.

A change to behavior or markup must be made in **both** copies (keep `app.js` / `index.html` identical);
only desktop-layout CSS goes in `web_version/style.css` alone. Check with
`diff todo-app/app.js todo-app/web_version/app.js` (should print nothing).

## Running

Open `index.html` in a browser (no server needed). The user works in Google Colab without a local
terminal, so there the page is served from the cloned repo and opened through a Colab port-forward
(`google.colab.output.serve_kernel_port_as_window`). `localStorage` then lives in the viewer's browser
under that forwarded URL, which changes every new Colab session, so saved todos won't carry over between
sessions (use export/import to move them).

## `app.js` architecture

Everything is inside one IIFE (no globals), split into commented sections in this order:
`state` → `storage` → `actions` → `selectors` → `classifier` → `render` / `quotes` → `events` → `init()`.

- **`state`**: single object: `todos`, `filter` (`category`, `status`, `search`, `importantOnly`),
  `sort`, `autoClassify` settings. Named constants (`MAX_TEXT_LENGTH` = 100, toast/animation durations)
  sit right below it.
- **Data flow**: every action mutates `state`, calls `save(state.todos)`, then `render()`. `render()`
  rebuilds the whole list from `getVisibleTodos()` each time (no incremental DOM updates).
- **Order**: `state.todos` array order *is* the user's custom ("내 순서") order. Selectors filter/sort a
  **copy**; only `reorderTodo` / `moveTodoBy` change `state.todos` order. Drag handles/reordering only apply
  under `sort === "custom"`.
- **Todo shape**: `{ id, text, category, done, important, createdAt, completedAt }` (timestamps are
  `Date.now()` ms, `completedAt` is `null` while not done).

## Storage keys

| Key | Holds |
|---|---|
| `todo-app:v1` | `{ version: 2, todos }`. `load()` fills a missing `important` with `false`, so old v1 data still loads |
| `todo-app:v1:corrupt` | the raw string, if `todo-app:v1` failed to parse (the app then starts empty and shows a banner) |
| `todo-app:v1:backup` | the previous list, saved right before an import *replaces* everything |
| `todo-app:settings` | theme, sort, auto-classify settings (kept separate from todo data) |

The small inline `<script>` in `index.html`'s `<head>` reads `todo-app:settings` to set `data-theme`
before first paint (avoids a light/dark flash). If the settings key or theme format changes, update it too.

Imported JSON goes through `validateImportedTodos()`; keep it in sync with the todo shape above.

## Auto-classification

`KEYWORDS` (in the `classifier` section) maps each category to keyword lists; `classifyTodoWithMinScore`
picks the category with the most matches (whitespace/case-insensitive); it returns `null` on a tie or when
the top score is below the user's `minScore`.
Runs debounced (`CLASSIFY_DEBOUNCE_MS`) while typing and stops overriding once the user clicks a category
chip themselves for that entry. To improve classification, edit `KEYWORDS`.
