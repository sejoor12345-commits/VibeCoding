# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-04` is where the book's API-based AI service practice lives ("혼자 공부하는 바이브코딩 with 클로드
코드", repo root: `VibeCoding/`, alongside `Study-01/`–`Study-03/`). It calls LLMs through the
**OpenRouter** API (OpenAI-compatible chat completions endpoint, `https://openrouter.ai/api/v1/chat/completions`)
using plain Python + `requests` (preinstalled on Colab, so no install step).

Current state: no code yet. Exercises get added as the book
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
- No `.env` / `.gitignore` in this folder on purpose: the book assumes a local PC with a `.env` file, but
  here Colab Secrets replace `.env` entirely. When the book says "put the key in `.env`", translate it to
  the Colab cell above. If code uses `python-dotenv`'s `load_dotenv()`, that's fine — it just finds no
  file and the env var set by the cell is used.
