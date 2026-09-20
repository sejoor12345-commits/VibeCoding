# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Personal study repository for working through "혼자 공부하는 바이브코딩 with 클로드 코드". Each chapter's
exercise lives in its own `Study-NN/` folder. `Study-01/` is a handwritten digit recognizer built with
scikit-learn and Gradio, currently the only exercise in the repo. Expect additional `Study-NN/` folders
to be added as the book progresses — do not assume `Study-01/` is the only or final one.

## Commands

Run all commands from inside `Study-01/` (or the relevant `Study-NN/` folder).

```bash
pip install -r requirements.txt   # install dependencies
python digit_recognition.py       # run the app (opens a browser to the drawing canvas)
```

In Google Colab (no local Python required), use the IPython magics instead of `!python`, so the Gradio
UI renders inline in the notebook:
```python
!git clone -b claude/friendly-curie-nz960w https://github.com/sejoor12345-commits/VibeCoding.git
%cd VibeCoding/Study-01
!pip install -r requirements.txt
%run digit_recognition.py
```

On Windows, `install_requirements.bat` and `run_digit_recognition.bat` wrap the two commands above for
double-click use; both still require a local Python installation.

There is no lint, test, or build command configured in this repo yet.

## Architecture

### `Study-01/digit_recognition.py` — single-file app

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

### Path resolution for PyInstaller bundling

`BASE_DIR` is computed via `sys.frozen` / `sys._MEIPASS` so the same script works both as a normal `.py`
file and when frozen into a standalone `.exe` (bundled data files extract to a temp dir at runtime, not
next to the script). `MODEL_PATH` and `DATA_PATH` are both derived from `BASE_DIR`. If you add another
data file the script reads at runtime, it needs the same `BASE_DIR` treatment and a matching `--add-data`
entry in the workflow below.

### `.github/workflows/build_windows_exe.yml` — standalone .exe build

Builds `DigitRecognizer.exe` via PyInstaller on a `windows-latest` runner (a real .exe must be built on
Windows) and uploads it as a build artifact. Triggers automatically on push to the
`claude/friendly-curie-nz960w` branch when `Study-01/digit_recognition.py`, `Study-01/mnist_model.joblib`,
or `Study-01/requirements.txt` change — the branch name is hardcoded in the `paths` trigger, so update it
if the working branch changes. Also triggerable manually via `workflow_dispatch`. Gradio's frontend assets
aren't picked up by PyInstaller's default import analysis, hence the `--collect-all gradio` /
`gradio_client` / `safehttpx` / `groovy` flags — if the build fails with missing Gradio assets/templates,
that flag list is the first place to extend.
