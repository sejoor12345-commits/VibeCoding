# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-05` is the next study session under "혼자 공부하는 바이브코딩 with 클로드 코드" (repo root:
`VibeCoding/`), alongside `Study-01/`–`Study-04/`. It develops the user's **military shift-roster web app**
(교대근무 근무표 작성기), imported from [sejoor12345-commits/timetable](https://github.com/sejoor12345-commits/timetable)
(`index.html` → `Study-05/timetable.html`, `PRD.md` → `Study-05/PRD.md`), by adding **AI via the OpenRouter API**
so each person's natural-language preferences (e.g. "A는 주말 주간 선호", "B는 주 비 주 비 주 야 비 흐름 선호") shape
the auto-generated roster.

- `PRD.md` — the original roster rules (shifts, 위로휴가, 필수 조건, 벌점, UI). Still the source of truth for rules.
- `PRD_step1.md` — the AI preference feature (written by `product-manager`). Where it differs from `PRD.md`, it wins.

## Architecture decisions (made with the user's request in mind — keep them)

- **Hybrid, not "LLM writes the roster".** An LLM filling a 28–35 day roster routinely breaks hard rules (야간 다음
  날 주간, 야야야, 인원 공백) and miscounts 위로휴가 hours. So the AI does what it's good at — reading free-text
  preferences and turning them into **structured preference rules** (a small closed set of rule types) — and the
  existing rule engine in `timetable.html` (`computePenalty`, `createAutoFiller`) does the search, with a new
  **preference penalty** term. Hard constraints are never relaxed for a preference; preferences rank below
  인원 공백·필수 조건, 위로휴가 목표, 기준 근무 개수 and 야야.
- **Model:** `stealth/space-bunny-alpha` (user's choice). One constant in the Python client; don't change it.
- **Key:** only from env var `OPENROUTER_API_KEY`, copied from Colab 보안 비밀 (🔑) in a notebook cell
  (same as `Study-04/CLAUDE.md` → "API key handling"). The key never reaches the browser.
- **Server:** `timetable_server/` — Python standard library `http.server` + `requests` (both preinstalled on
  Colab, so no install step). It serves `timetable.html` at `/` and the AI endpoints under `/api/`. In Colab it runs
  in the background and is opened with `google.colab.output.serve_kernel_port_as_window(<port>)`; the page calls the
  API with relative URLs, so it works through the Colab proxy.
- **`timetable.html` stays one self-contained file** (HTML+CSS+JS inline, no CDN/external libraries, Chrome/Edge,
  phone width). Double-clicked offline it must still do everything it did before, including applying preference
  rules already saved in it (localStorage + backup code); only the AI buttons need the Colab server, and they say so.
- **Privacy:** only the preference text, the people's names and the period dates go to OpenRouter — not the roster.
  The UI reminds the user to use pseudonyms (A, B, C…), never real names or unit info.

## Rules carried over from the original repo

- Calculation logic (hours, 위로휴가, rule checks, penalties, preference scoring) lives in functions that take
  inputs and return results — no DOM reads/writes. UI code only calls them and renders.
- Test data uses pseudonyms A, B, C, D, E only.
- The built-in `runTests()` in `timetable.html` (run from the browser console) must keep passing; extend it for
  new calculation functions.
- The original repo's `excel/` VBA version is not imported and not updated.

## Testing in this container

No API key here and `openrouter.ai` is blocked, so AI calls are verified against fakes: patch `requests.post`
(see `Study-04/CLAUDE.md`) or point the client at a local fake OpenRouter server. Browser checks use the global Node
Playwright (`/opt/node22/lib/node_modules/playwright`, Chromium at `/opt/pw-browsers`). Real AI quality/speed is
checked by the user in Colab.

## Subagent team (`.claude/agents/`)

Five subagents, all `model: inherit` with no `tools` line (= all tools), loaded only when `Study-05/` is the
working directory. Their prompts are in Korean and each ends with a Korean report format.

| Agent | Role |
|---|---|
| `product-manager` | Owns the schedule; writes `PRD_step1.md`, `PRD_step2.md`, … (same outline as `Study-04/PRD_step*.md`), tags each requirement with its owner. Writes docs, not app code. |
| `ai-integration-specialist` | OpenRouter client (one file, model name as one constant), prompts, generation/summarization. Carries over Study-04's lessons (total-time deadline, `<think>` stripping, friendly 401/429/5xx messages). |
| `backend-developer` | Server/API, data processing and storage (Google Drive in Colab, atomic writes), non-AI external services, security. Calls the AI specialist's functions instead of writing its own OpenRouter code. |
| `frontend-developer` | UI, responsive layout (narrow sajibang browser via Colab), accessibility, UI performance. Calls backend/AI functions; no data or AI code in UI files. |
| `qa-engineer` | Tests PRD completion criteria, error handling (fake 401/429/5xx/timeout/empty responses), performance, code review, usability — and **fixes the bugs it finds**, re-testing until they're resolved. |

Intended flow per step: `product-manager` → `ai-integration-specialist` / `backend-developer` /
`frontend-developer` → `qa-engineer`. None of them commit or push; the caller decides. Subagents can't ask the user
directly, so open decisions come back in their reports ("사용자에게 물어볼 것") for the main session to relay.
