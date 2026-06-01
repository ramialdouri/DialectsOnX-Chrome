from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from xai_sdk import Client
from xai_sdk.chat import system, user

load_dotenv(override=True)

app = FastAPI(title="DialX Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Client(api_key=os.getenv("GROK_API_KEY"))

class TranslateRequest(BaseModel):
    text: str
    source: str = "auto"
    target: str

SYSTEM_PROMPT = """
Translate naturally into the requested Arabic dialect with proper slang and tone.
Always use real Arabic script only. Never use English/Latin letters (no Arabizi).
Keep the original meaning, emotion, and energy.
Return only the translation, no explanations.
"""

@app.post("/translate")
async def translate(request: TranslateRequest):
    try:
        print(f"[REQUEST] Target Dialect: {request.target} | Text length: {len(request.text)}")
        
        chat = client.chat.create(model="grok-4.3")
        chat.append(system(SYSTEM_PROMPT))
        chat.append(user(f"Translate this text to {request.target} Arabic dialect naturally:\n\n{request.text}"))
        
        response = chat.sample()
        translated = response.content.strip()
        
        print(f"[SUCCESS] Translated to {request.target} | Output length: {len(translated)}")
        return {"translation": translated}
        
    except Exception as e:
        print("Translation Error:", type(e).__name__, str(e))
        return {"translation": request.text}

if __name__ == "__main__":
    print("DialX Backend is running with xAI SDK + Grok 4.3...")