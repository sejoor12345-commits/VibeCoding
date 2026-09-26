# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`Study-04` is where the book's API-based AI service practice lives ("혼자 공부하는 바이브코딩 with 클로드
코드", repo root: `VibeCoding/`, alongside `Study-01/`–`Study-03/`). It calls LLMs through the
**OpenRouter** API (OpenAI-compatible chat completions endpoint, `https://openrouter.ai/api/v1/chat/completions`)
using plain Python + `requests` (preinstalled on Colab, so no install step).

Current state: `api_test.py` — smoke test for the API with model `stealth/space-bunny-alpha`: a text
question, then an image question (a Pillow-generated PNG with a red circle, blue square and "HELLO 2026",
sent as a base64 `data:` URL in an `image_url` content part). Each test catches and prints its own error,
including the server's response body.

Planned app: a fridge-photo → recipe web app, specified in three PRDs (Korean, user-facing):
`PRD_step1.md` (photo → ingredient list via the vision model), `PRD_step2.md` (ingredients → recipe JSON),
`PRD_step3.md` (nickname profiles + saved recipes in a JSON file, on Google Drive in Colab). Code goes in
`fridge_recipe/` (Streamlit UI, run in Colab as a background server opened via
`google.colab.output.serve_kernel_port_as_window(8501)` — see `PRD_step1.md` §8; `openrouter_client.py` as the single place holding `MODEL` and request/error
handling). Build one step at a time; read the matching PRD first and treat its 완료 기준 as the checklist.
Steps 1–2 are built (`app.py`, `openrouter_client.py`, `vision.py`, `recipe.py`). Streamlit reruns `app.py`
top to bottom on every interaction, so state that must survive (`message`, `ingredients_text`, `recipes` —
the normalized recipe dicts step 3 will save as-is, `recipe_error`) lives in `st.session_state`.
Verify without the real API by patching `requests.post` (e.g. a `sitecustomize.py` on `PYTHONPATH` that
returns a canned OpenRouter JSON), then drive it with `streamlit.testing.v1.AppTest` or Playwright
(`executable_path="/opt/pw-browsers/chromium"`).

Claude's cloud container can't run these for real: it has no key, and its network policy blocks
`openrouter.ai`. Hand the user Colab cells instead and ask them to paste the output back.

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
