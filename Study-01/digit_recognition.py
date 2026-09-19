"""
Handwritten Digit Recognition
This program trains a simple machine learning model to recognize
handwritten digits (0-9) and shows how accurate it is.
"""

import matplotlib.pyplot as plt
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score

# 1. Load the built-in handwritten digits dataset (8x8 pixel images, digits 0-9)
digits = load_digits()
images = digits.images   # the raw 8x8 images, used only for drawing later
X = digits.data          # each image flattened into 64 numbers (pixel brightness)
y = digits.target        # the correct answer (label) for each image, 0-9

print(f"Total number of digit images: {len(X)}")

# 2. Split the data into a training set (to study) and a test set (to check understanding)
X_train, X_test, y_train, y_test, img_train, img_test = train_test_split(
    X, y, images, test_size=0.2, random_state=42
)

print(f"Training images: {len(X_train)}, Test images: {len(X_test)}")

# 3. Create and train a simple neural network classifier
model = MLPClassifier(hidden_layer_sizes=(64,), max_iter=1000, random_state=42)
model.fit(X_train, y_train)

# 4. Test the trained model on images it has never seen before
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print(f"Accuracy on test data: {accuracy * 100:.2f}%")

# 5. Draw the first 10 test images with the model's predicted label
fig, axes = plt.subplots(2, 5, figsize=(10, 5))
for ax, image, true_label, predicted_label in zip(
    axes.ravel(), img_test, y_test, predictions
):
    ax.imshow(image, cmap="gray")
    ax.set_title(f"True: {true_label} / Pred: {predicted_label}")
    ax.axis("off")

plt.tight_layout()
output_path = "digit_recognition_result.png"
plt.savefig(output_path)
print(f"Saved prediction results to {output_path}")
