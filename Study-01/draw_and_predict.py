"""
Draw a Digit and Predict
This program loads the digit recognition model saved by
train_digit_model.py, shows a drawing canvas, and predicts which
digit (0-9) you drew with your mouse.
"""

import joblib
import numpy as np
from PIL import Image
import gradio as gr

# 1. Load the model that was trained and saved by train_digit_model.py
MODEL_PATH = "mnist_model.joblib"
model = joblib.load(MODEL_PATH)


def predict_digit(sketch):
    if sketch is None:
        return None

    # 2. The Sketchpad gives back a dictionary; the final drawing is
    #    stored under the "composite" key
    image_array = sketch["composite"]
    if image_array is None:
        return None

    image = Image.fromarray(image_array)

    # 3. If the drawing has a transparent background, fill it with white
    #    first so blank areas do not turn into random colors
    if image.mode == "RGBA":
        white_background = Image.new("RGB", image.size, (255, 255, 255))
        white_background.paste(image, mask=image.split()[3])
        image = white_background

    # 4. Convert to a grayscale 28x28 image, matching the MNIST format
    image = image.convert("L").resize((28, 28))
    pixels = np.array(image)

    # 5. The canvas has dark strokes on a light background, but MNIST
    #    digits are light strokes on a dark background, so invert the
    #    colors and scale them to the 0-1 range
    pixels = 255 - pixels
    pixels = pixels / 255.0

    # 6. Feed the image into the trained model and get a probability
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
