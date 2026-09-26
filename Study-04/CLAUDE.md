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
`google.colab.output.serve_kernel_port_as_window(8501)`, with `--server.enableCORS false
--server.enableXsrfProtection false` (without the CORS flag the Colab proxy's websocket is rejected
intermittently → endless loading; the user hit this) — see `PRD_step1.md` §8; `openrouter_client.py` as the single place holding the models — `VISION_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"`
(a reasoning model: `chat` strips `<think>…</think>` and rejects empty content) for photo recognition, `TEXT_MODEL = "stealth/space-bunny-alpha"` for recipes, picked via `chat(..., model=)` — and request/error
handling). Build one step at a time; read the matching PRD first and treat its 완료 기준 as the checklist.
All 3 steps are built: `vision.py` (1), `recipe.py` (2, plus profile rules + allergy filter for 3),
`storage.py` (3: `profiles.json` under `RECIPE_DATA_DIR`, a Google Drive folder in Colab, else
`fridge_recipe/data/` which is gitignored; atomic write via temp file + `os.replace`; a corrupt file is moved to
`profiles.corrupt.json`). Streamlit reruns `app.py` top to bottom on every interaction, so state that must
survive (`message`, `ingredients_text`, `recipes`, `recipe_source_ingredients`, `profile_name`, `notice`…)
lives in `st.session_state`. Anything that changes an already-rendered widget's value (e.g. selecting the new
profile, setting `servings`) happens in an `on_click`/`on_change` callback. User feedback uses inline
`notice`s shown next to the triggering button and cleared at the *end* of the script — not `st.toast`, which
silently dropped a second toast while one was still visible, and not cleared at the start, because
typing-then-clicking fires two back-to-back reruns and the first can be interrupted.
`openrouter_client.chat` enforces a *total* deadline (`TIMEOUT_SECONDS`, 120s): it posts with `stream=True`
and reads the body 1 byte at a time, checking the clock. A plain `requests` `timeout` only bounds silence
between bytes, and OpenRouter sends whitespace keep-alives while the model works, so the old 60s timeout never
fired (the user saw recognition hang past a minute with no message). Fakes of `requests.post` must therefore
return an object usable as a context manager with `status_code` and `iter_content()`.
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
