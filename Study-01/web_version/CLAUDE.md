# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is the **web** build of the `Study-01` handwritten digit recognizer (repo root: `VibeCoding/`,
chapter folder: `Study-01/`), meant to run permanently on a hosting service with a public URL, rather than
locally. The sibling folder `../desktop_version/` is the same recognizer adapted for local/offline use
(Python script, `.bat` launchers, standalone `.exe`) — see its own `CLAUDE.md`. Keep `predict_digit()` and
`load_or_train_model()` in sync between the two if the recognition logic changes; their app entry points,
dependencies, and deployment mechanics are intentionally separate and shouldn't be merged.

## Commands

Run all commands from inside this folder.

```bash
pip install -r requirements.txt   # install dependencies
python app.py                     # run locally at http://127.0.0.1:7860 (for testing before deploying)
```

There is no lint, test, or build command configured in this repo yet.

### Deploying to Hugging Face Spaces

This folder's layout (`app.py` + `requirements.txt` + `README.md` with the YAML front matter block) is the
exact structure [Hugging Face Spaces](https://huggingface.co/spaces) expects for a Gradio Space:
1. Create a new Space on huggingface.co with SDK "Gradio".
2. Push this folder's contents to the Space's git remote (Spaces are themselves git repos).
3. The Space reads `README.md`'s front matter (`sdk_version`, `app_file: app.py`) to know how to run it,
   installs `requirements.txt`, and serves `app.py` at a permanent `https://huggingface.co/spaces/...` URL.

If `sdk_version` in `README.md` and the `gradio` version in `requirements.txt` drift apart, keep them
equal — Spaces installs the `gradio` package version pinned in `sdk_version`.

## Architecture

### `app.py` — single-file Gradio app

Structurally identical to `../desktop_version/digit_recognition.py` minus the PyInstaller/`.exe`-specific
parts (no `sys.frozen` / `sys._MEIPASS` branching, no `inbrowser=True`, since there's no local browser to
open on a server):
1. **`load_or_train_model()`** — loads the committed `mnist_model.joblib` if present (this is the normal
   path for both local testing and Space deploys, so the app never waits on training); otherwise downloads
   MNIST from `https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz` and trains a fresh
   `MLPClassifier`.
2. **`predict_digit(sketch)`** — same preprocessing as the desktop version: extract the `composite` key
   from the Sketchpad dict, flatten transparency onto white, resize to 28x28, invert colors (canvas is
   dark-on-light, MNIST is light-on-dark), normalize, then `model.predict_proba`.
3. **`demo = gr.Interface(...)`** at module scope; `demo.launch()` under `if __name__ == "__main__"` is
   only exercised when running this file directly for local testing — Spaces itself serves `demo` via the
   `app_file` reference in `README.md`, not by executing this block.

### `README.md` — Space configuration, not just documentation

The YAML front matter at the top (`title`, `sdk`, `sdk_version`, `app_file`, etc.) is read by Hugging Face
Spaces to configure the deployment. Don't remove or reformat it when editing the human-readable
description below it.
