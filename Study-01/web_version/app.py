"""
Handwritten Digit Recognition - Web Version
This is the web-hosted version of the digit recognizer. Unlike the
desktop version, it is meant to run permanently on a server (for
example Hugging Face Spaces), so anyone with the URL can use it
without installing anything.
"""

import os
import urllib.request

import joblib
import numpy as np
from PIL import Image
import gradio as gr
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "mnist_model.joblib")
DATA_URL = "https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz"
DATA_PATH = os.path.join(BASE_DIR, "mnist_cache.npz")


def load_or_train_model():
    # 1. Reuse the pre-trained model that is committed alongside this file,
    #    so the web app starts instantly instead of retraining on every
    #    server restart
    if os.path.exists(MODEL_PATH):
        print("Loading previously trained model...")
        return joblib.load(MODEL_PATH)

    # 2. Otherwise, download the MNIST dataset and train a model
    print("No trained model found. Training on the MNIST dataset (first run only)...")
    if not os.path.exists(DATA_PATH):
        print("Downloading MNIST dataset...")
        urllib.request.urlretrieve(DATA_URL, DATA_PATH)

    with np.load(DATA_PATH) as data:
        x_train, y_train = data["x_train"], data["y_train"]
        x_test, y_test = data["x_test"], data["y_test"]

    x_train_flat = x_train.reshape(len(x_train), -1) / 255.0
    x_test_flat = x_test.reshape(len(x_test), -1) / 255.0

    new_model = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=60, random_state=42)
    new_model.fit(x_train_flat, y_train)

    accuracy = accuracy_score(y_test, new_model.predict(x_test_flat))
    print(f"Training complete. Accuracy on MNIST test data: {accuracy * 100:.2f}%")

    joblib.dump(new_model, MODEL_PATH)
    return new_model


model = load_or_train_model()


def predict_digit(sketch):
    if sketch is None:
        return None

    # 3. The Sketchpad gives back a dictionary; the final drawing is
    #    stored under the "composite" key
    image_array = sketch["composite"]
    if image_array is None:
        return None

    image = Image.fromarray(image_array)

    # 4. If the drawing has a transparent background, fill it with white
    #    first so blank areas do not turn into random colors
    if image.mode == "RGBA":
        white_background = Image.new("RGB", image.size, (255, 255, 255))
        white_background.paste(image, mask=image.split()[3])
        image = white_background

    # 5. Convert to a grayscale 28x28 image, matching the MNIST format
    image = image.convert("L").resize((28, 28))
    pixels = np.array(image)

    # 6. The canvas has dark strokes on a light background, but MNIST
    #    digits are light strokes on a dark background, so invert the
    #    colors and scale them to the 0-1 range
    pixels = 255 - pixels
    pixels = pixels / 255.0

    # 7. Feed the image into the trained model and get a probability
    #    for each possible digit
    flat = pixels.reshape(1, -1)
    probabilities = model.predict_proba(flat)[0]

    return {str(digit): float(probabilities[digit]) for digit in range(10)}


demo = gr.Interface(
    fn=predict_digit,
    inputs=gr.Sketchpad(label="Draw a digit (0-9)"),
    outputs=gr.Label(num_top_classes=3, label="Prediction"),
    title="Handwritten Digit Recognizer",
    description="Draw a single digit from 0 to 9 with your mouse, then click Submit.",
)

if __name__ == "__main__":
    demo.launch()
