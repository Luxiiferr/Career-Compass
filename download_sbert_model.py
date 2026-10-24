"""Download the SBERT model during cloud builds so production uses semantic matching."""
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
SentenceTransformer(MODEL_NAME)
print(f"Downloaded and cached {MODEL_NAME}.")
