"""
Handwritten Digit Recognition - MNIST Version
This program downloads the full MNIST dataset (28x28 pixel handwritten
digit images) and trains a neural network to recognize the digits.

Note: MNIST images are a different size (28x28) than the sklearn
built-in digits dataset (8x8) used in digit_recognition.py, so this
is a separate model trained from scratch on larger, real-world data.
"""

import os
import urllib.request

import numpy as np
import matplotlib.pyplot as plt
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score

# 1. Download the MNIST dataset file if it is not already cached locally
DATA_URL = "https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz"
DATA_PATH = "/tmp/mnist_cache/mnist.npz"

os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
if not os.path.exists(DATA_PATH):
    print("Downloading MNIST dataset...")
    urllib.request.urlretrieve(DATA_URL, DATA_PATH)
    print("Download complete.")
else:
    print("Using cached MNIST dataset.")

# 2. Load the images and labels from the downloaded file
with np.load(DATA_PATH) as data:
    x_train, y_train = data["x_train"], data["y_train"]
    x_test, y_test = data["x_test"], data["y_test"]

print(f"Full training set: {len(x_train)} images, test set: {len(x_test)} images")

# 3. Use a subset of the training images to keep training time reasonable
TRAIN_SAMPLE_SIZE = 10000
x_train_sample = x_train[:TRAIN_SAMPLE_SIZE]
y_train_sample = y_train[:TRAIN_SAMPLE_SIZE]
print(f"Training on a sample of {TRAIN_SAMPLE_SIZE} images")

# 4. Flatten each 28x28 image into a list of 784 numbers, scaled to 0-1
x_train_flat = x_train_sample.reshape(len(x_train_sample), -1) / 255.0
x_test_flat = x_test.reshape(len(x_test), -1) / 255.0

# 5. Train a neural network classifier on the MNIST training images
model = MLPClassifier(hidden_layer_sizes=(100,), max_iter=30, random_state=42)
model.fit(x_train_flat, y_train_sample)

# 6. Test the trained model on MNIST test images it has never seen
predictions = model.predict(x_test_flat)
accuracy = accuracy_score(y_test, predictions)
print(f"Accuracy on MNIST test data: {accuracy * 100:.2f}%")

# 7. Draw the first 10 test images with the model's predicted label
fig, axes = plt.subplots(2, 5, figsize=(10, 5))
for ax, image, true_label, predicted_label in zip(
    axes.ravel(), x_test[:10], y_test[:10], predictions[:10]
):
    ax.imshow(image, cmap="gray")
    ax.set_title(f"True: {true_label} / Pred: {predicted_label}")
    ax.axis("off")

plt.tight_layout()
output_path = "mnist_recognition_result.png"
plt.savefig(output_path)
print(f"Saved prediction results to {output_path}")
