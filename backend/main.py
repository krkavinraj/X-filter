import os
import vertexai
from vertexai.generative_models import GenerativeModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

# --- Google Cloud Vertex AI Initialization ---
# Explicitly initialize Vertex AI with the project and location.
# Preview models often require a specific location, like 'global', to be found.
try:
    vertexai.init(project="xfilter-465206", location="global")
except Exception as e:
    print(f"Could not initialize Vertex AI: {e}")

# Load the Gemini model
# Using the specific preview model as requested.
try:
    model = GenerativeModel("gemini-2.5-flash-lite-preview-06-17")
except Exception as e:
    print(f"Could not load Gemini model: {e}")
    model = None # Set model to None if it fails to load

app = FastAPI()

# Add CORS middleware
# This allows your extension (running on x.com) to make requests to your backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for robust testing
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (e.g., POST)
    allow_headers=["*"],  # Allows all headers
)

class TweetsRequest(BaseModel):
    tweets: List[str]
    prompt: Optional[str] = "Is this tweet about startups, entrepreneurship, building tech products, or business growth?"

@app.get("/")
def read_root():
    return {"message": "X-Filter Backend is running on Google Cloud with Gemini."}

@app.post("/api/filter-tweets")
async def filter_tweets(request: TweetsRequest):
    if not request.tweets:
        raise HTTPException(status_code=400, detail="No tweets provided.")
    if not model:
        raise HTTPException(status_code=503, detail="Gemini model is not available.")

    try:
        # The system prompt is now part of the main prompt for Gemini
        full_prompt = build_prompt_for_gemini(request.tweets, request.prompt)

        # Generate content
        response = model.generate_content(full_prompt)

        results_text = response.text
        boolean_results = parse_results(results_text, len(request.tweets))
        
        return {"results": boolean_results}

    except Exception as e:
        print(f"An unexpected error occurred with Vertex AI: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred with the Gemini API: {e}")

def build_prompt_for_gemini(tweets: List[str], rule: str) -> str:
    """Builds the prompt for the Gemini model."""
    # System instruction for the model
    system_instruction = "You are a tweet classifier. The user will provide a rule and a list of tweets. For each tweet, return \"YES\" or \"NO\" indicating if it matches the user's rule. Respond with a numbered list, with each result on a new line. Do not add any other text or explanation."
    
    # User's specific request
    user_prompt_lines = [
        "My rule is:",
        f'"{rule}"',
        "\nTweets to classify:",
    ]
    for i, tweet in enumerate(tweets, 1):
        # Basic sanitization to avoid breaking the prompt format
        sanitized_tweet = tweet.replace('"', "'").replace('\n', ' ')
        user_prompt_lines.append(f'{i}. "{sanitized_tweet}"')
    
    user_content = "\n".join(user_prompt_lines)

    # Combine system and user prompts
    return f"{system_instruction}\n\n---\n\n{user_content}"

def parse_results(results_text: str, expected_count: int) -> List[bool]:
    """Parses the model's YES/NO response into a list of booleans."""
    if not results_text:
        print(f"Warning: Empty response from model. Expected {expected_count} results.")
        # Default to not filtering to be safe
        return [True] * expected_count
        
    lines = results_text.strip().split('\n')
    results = []
    for line in lines:
        # Handle lines like "1. YES" or just "YES"
        cleaned_line = line.split('.')[-1].strip().upper()
        if "YES" in cleaned_line:
            results.append(True)
        elif "NO" in cleaned_line:
            results.append(False)
    
    # If parsing fails or the count is mismatched, default to keeping the tweets.
    # This is safer than accidentally hiding everything.
    if len(results) != expected_count:
        print(f"Warning: Mismatch in result count. Expected {expected_count}, got {len(results)}. Response: '{results_text}'")
        return [True] * expected_count

    return results

if __name__ == "__main__":
    # Cloud Run injects the PORT environment variable.
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
