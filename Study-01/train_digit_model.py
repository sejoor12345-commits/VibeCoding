"""
Train and Save a Digit Recognition Model
This program trains a neural network on the full MNIST dataset and
saves the trained model to a file so it can be reused later without
retraining (for example, by the interactive drawing app).
"""

import os
import urllib.request

import joblib
import numpy as np
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

print(f"Training on the full set: {len(x_train)} images")

# 3. Flatten each 28x28 image into a list of 784 numbers, scaled to 0-1
x_train_flat = x_train.reshape(len(x_train), -1) / 255.0
x_test_flat = x_test.reshape(len(x_test), -1) / 255.0

# 4. Train a neural network on the full MNIST training set
#    (more data and more iterations than the earlier example, so the
#    model generalizes better to someone else's real handwriting)
model = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=60, random_state=42)
model.fit(x_train_flat, y_train)

# 5. Check accuracy on the MNIST test set
predictions = model.predict(x_test_flat)
accuracy = accuracy_score(y_test, predictions)
print(f"Accuracy on MNIST test data: {accuracy * 100:.2f}%")

# 6. Save the trained model to a file
MODEL_PATH = "mnist_model.joblib"
joblib.dump(model, MODEL_PATH)
print(f"Saved trained model to {MODEL_PATH}")
