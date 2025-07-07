from google import genai
from google.genai import types
client = genai.Client(
vertexai=True, project="xfilter-465206", location="global",
)
# If your image is stored in Google Cloud Storage, you can use the from_uri class method to create a Part object.
IMAGE_URI = "gs://generativeai-downloads/images/scones.jpg"
model = "gemini-2.5-flash-lite-preview-06-17"
response = client.models.generate_content(
model=model,
contents=[
  "can you explain what is AI in simple terms"
],
)
print(response.text, end="")