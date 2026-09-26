# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-04` is where the book's API-based AI service practice lives ("혼자 공부하는 바이브코딩 with 클로드
코드", repo root: `VibeCoding/`, alongside `Study-01/`–`Study-03/`). It calls LLMs through the
**OpenRouter** API (OpenAI-compatible chat completions endpoint, `https://openrouter.ai/api/v1/chat/completions`)
using plain Python + `requests` (preinstalled on Colab, so no install step).

Current state: setup only (`.gitignore`, `.env.example`) — no code yet. Exercises get added as the book
goes on.

## API key handling (important)

- Code should read the key **only** from the `OPENROUTER_API_KEY` environment variable. Never hardcode a
  key in source or notebooks, never commit it.
- The user runs everything in **Google Colab** (no local terminal). There the key lives in Colab's
  보안 비밀(Secrets, key icon in the left sidebar) under the name `OPENROUTER_API_KEY`, and a notebook cell
  copies it into the environment before running scripts:
  ```python
  import os
  from google.colab import userdata
  os.environ["OPENROUTER_API_KEY"] = userdata.get("OPENROUTER_API_KEY")
  ```
  (`userdata.get` only works inside notebook cells, not inside a `!python` subprocess — which is why the
  scripts read the env var instead; env vars set in the kernel are inherited by `!python` / `%run`.)
- For when the user pulls this repo onto a local PC someday, `.gitignore` excludes `.env` and
  `.env.example` is the committed template (copy it to `.env` locally and fill in the key). Never commit a
  real `.env`. In Colab, `.env` isn't used — Colab Secrets replace it; when the book says "put the key in
  `.env`", translate it to the Colab cell above. `load_dotenv()` in book code is harmless in Colab: it finds
  no file and the env var set by the cell is used.
