# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-05` is the next study session under "혼자 공부하는 바이브코딩 with 클로드 코드" (repo root:
`VibeCoding/`), alongside `Study-01/`–`Study-04/`. It will use LLMs through the **OpenRouter** API for text
generation and summarization. The product itself, the tech stack and the AI model are not decided yet — the
user will describe them. Until then, don't pick a model or stack on the user's behalf.

## Subagent team (`.claude/agents/`)

Five subagents, all `model: inherit` with no `tools` line (= all tools), loaded only when `Study-05/` is the
working directory. Their prompts are in Korean and each ends with a Korean report format.

| Agent | Role |
|---|---|
| `product-manager` | Owns the schedule; writes `PRD_step1.md`, `PRD_step2.md`, … (same outline as `Study-04/PRD_step*.md`), tags each requirement with its owner. Writes docs, not app code. |
| `ai-integration-specialist` | OpenRouter client (one file, model name as one constant), prompts, generation/summarization. Carries over Study-04's lessons (total-time deadline, `<think>` stripping, friendly 401/429/5xx messages). |
| `backend-developer` | Server/API, data processing and storage (Google Drive in Colab, atomic writes), non-AI external services, security. Calls the AI specialist's functions instead of writing its own OpenRouter code. |
| `frontend-developer` | UI, responsive layout (narrow sajibang browser via Colab), accessibility, UI performance. Calls backend/AI functions; no data or AI code in UI files. |
| `qa-engineer` | Tests PRD completion criteria, error handling (fake 401/429/5xx/timeout/empty responses), performance, code review, usability. Does **not** edit app code — reports bugs grouped by owner. |

Intended flow per step: `product-manager` → `ai-integration-specialist` / `backend-developer` /
`frontend-developer` → `qa-engineer` → fixes by the owning agent. None of them commit or push; the caller
decides. Subagents can't ask the user directly, so open decisions come back in their reports ("사용자에게
물어볼 것") for the main session to relay.
