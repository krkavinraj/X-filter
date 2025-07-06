import os
from openai import AzureOpenAI, APIError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import uvicorn

# Load environment variables from .env file
load_dotenv()

# Configure Azure OpenAI client (v1.x)
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class TweetsRequest(BaseModel):
    tweets: List[str]
    prompt: Optional[str] = "Is this tweet about startups, entrepreneurship, building tech products, or business growth?"

@app.get("/")
def read_root():
    return {"message": "X-Filter Backend is running."}

@app.post("/api/filter-tweets")
async def filter_tweets(request: TweetsRequest):
    if not request.tweets:
        raise HTTPException(status_code=400, detail="No tweets provided.")

    try:
        user_content = build_prompt(request.tweets, request.prompt)

        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a tweet classifier. The user will provide a rule and a list of tweets. For each tweet, return \"YES\" or \"NO\" indicating if it matches the user's rule. Respond with a numbered list, with each result on a new line. Do not add any other text or explanation."},
                {"role": "user", "content": user_content}
            ],
            temperature=0,
            max_tokens=len(request.tweets) * 5, # Estimate tokens needed
            top_p=1,
            frequency_penalty=0,
            presence_penalty=0
        )

        results_text = response.choices[0].message.content
        boolean_results = parse_results(results_text, len(request.tweets))
        
        return {"results": boolean_results}

    except APIError as e:
        print(f"OpenAI API error: {e}")
        # Gracefully handle content filtering errors
        if e.code == 'content_filter':
            print("Content filter triggered. Defaulting to keeping all tweets in this batch.")
            # Return a list of True to prevent any tweets in this batch from being hidden
            return {"results": [True] * len(request.tweets)}
        
        raise HTTPException(status_code=500, detail=f"An error occurred with the OpenAI API: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

def build_prompt(tweets: List[str], rule: str) -> str:
    """Builds the prompt for the GPT model with the user's rule and a numbered list of tweets."""
    prompt_lines = [
        "My rule is:",
        f'"{rule}"',
        "\nTweets to classify:",
    ]
    for i, tweet in enumerate(tweets, 1):
        prompt_lines.append(f'{i}. "{tweet}"')
    return "\n".join(prompt_lines)

def parse_results(results_text: str, expected_count: int) -> List[bool]:
    """Parses the model's YES/NO response into a list of booleans."""
    if not results_text:
        print(f"Warning: Empty response from model. Expected {expected_count} results.")
        return [False] * expected_count
        
    lines = results_text.strip().split('\n')
    results = []
    for line in lines:
        cleaned_line = line.split('.')[-1].strip().upper()
        if cleaned_line == "YES":
            results.append(True)
        elif cleaned_line == "NO":
            results.append(False)
    
    if len(results) != expected_count:
        print(f"Warning: Mismatch in result count. Expected {expected_count}, got {len(results)}. Response was: {results_text}")
        return [False] * expected_count

    return results

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
