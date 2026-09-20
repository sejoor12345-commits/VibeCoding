# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is the **desktop** build of the `Study-01` handwritten digit recognizer (repo root: `VibeCoding/`,
chapter folder: `Study-01/`). It's a local Gradio app meant to be run directly with Python. The sibling
folder `../web_version/` is the same idea adapted for permanent public web hosting (see its own
`CLAUDE.md`) — keep the two in sync when the recognition logic changes, but their run/deploy mechanics are
different and shouldn't be merged.

## Commands

Run all commands from inside this folder.

```bash
pip install -r requirements.txt   # install dependencies
python digit_recognition.py       # run the app (opens a browser to the drawing canvas)
```

In Google Colab (no local Python required), use the IPython magics instead of `!python`, so the Gradio
UI renders inline in the notebook:
```python
!git clone -b claude/friendly-curie-nz960w https://github.com/sejoor12345-commits/VibeCoding.git
%cd VibeCoding/Study-01/desktop_version
!pip install -r requirements.txt
%run digit_recognition.py
```

On Windows, `install_requirements.bat` and `run_digit_recognition.bat` wrap the two commands above for
double-click use; both require a local Python installation.

There is no lint, test, or build command configured in this repo yet. Packaging this into a standalone
`.exe` (PyInstaller, no local Python required) was tried and dropped for now — see git history
(`build_windows_exe.yml`) if reviving it.

## Architecture

### `digit_recognition.py` — single-file app

One script does three jobs in sequence at import time (not gated behind `if __name__`), so importing the
module has side effects (loads/trains a model immediately):
1. **`load_or_train_model()`** — loads `mnist_model.joblib` if present; otherwise downloads MNIST from
   `https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz` (openml.org is blocked in this
   sandbox's network policy, so this Google-hosted mirror is used instead), trains an `MLPClassifier`, and
   saves the result so future runs skip training. `mnist_model.joblib` is committed to the repo so the app
   starts instantly out of the box.
2. **`predict_digit(sketch)`** — takes Gradio's `Sketchpad` dict (`composite` key), flattens transparency
   onto a white background, resizes to 28x28, **inverts colors** (canvas is dark-on-light, MNIST is
   light-on-dark) and normalizes before calling `model.predict_proba`.
3. **`demo = gr.Interface(...)`** at module scope, launched with `inbrowser=True` under
   `if __name__ == "__main__"`.
