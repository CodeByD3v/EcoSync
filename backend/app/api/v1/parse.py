import os
import json
import urllib.request
import logging
from typing import Literal, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter
from app.core import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboard", tags=["onboarding"])

class ParseRequest(BaseModel):
    message: str

class ParseResponse(BaseModel):
    diet: Optional[Literal["meat_heavy", "flexitarian", "vegetarian", "vegan"]] = None
    commute: Optional[Literal["drive", "transit", "two_wheeler", "walk"]] = None
    housing: Optional[Literal["house", "apartment", "shared"]] = None
    confidence: Literal["high", "low", "none"]

@router.post("/parse", response_model=ParseResponse)
def parse_onboarding(payload: ParseRequest) -> ParseResponse:
    settings = get_settings()
    api_key = settings.gemini_api_key
    
    fallback_response = ParseResponse(
        diet=None,
        commute=None,
        housing=None,
        confidence="none"
    )

    if not api_key:
        logger.warning("No GEMINI_API_KEY found. Using fallback parsing response.")
        return fallback_response

    prompt = f"""
    You are an AI that extracts lifestyle preferences from natural language descriptions for onboarding.
    Analyze the following user text:
    "{payload.message}"

    Extract the following categories:
    - diet: must be one of ["meat_heavy", "flexitarian", "vegetarian", "vegan"] or null if not mentioned or unclear.
    - commute: must be one of ["drive", "transit", "two_wheeler", "walk"] or null if not mentioned or unclear.
    - housing: must be one of ["house", "apartment", "shared"] or null if not mentioned or unclear.
    - confidence: must be one of ["high", "low"] depending on how confident you are in the extraction. If you cannot extract any category with certainty, set confidence to "low".

    Do NOT return any markdown, code blocks, or explanations.
    Output EXACTLY a valid JSON object with these exact keys:
    - "diet"
    - "commute"
    - "housing"
    - "confidence"

    Example JSON output:
    {{
      "diet": "vegetarian",
      "commute": "transit",
      "housing": "shared",
      "confidence": "high"
    }}
    """

    # We will try these models in order:
    models_to_try = []
    configured_model = settings.llm_model
    if configured_model:
        models_to_try.append(configured_model)
    for fallback_model in ["gemini-3.5-flash", "gemini-2.5-flash"]:
        if fallback_model not in models_to_try:
            models_to_try.append(fallback_model)

    last_error = None
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        req_payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(req_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
                
                # Clean possible markdown wrapping just in case
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:-3].strip()
                elif raw_text.startswith("```"):
                    raw_text = raw_text[3:-3].strip()

                parsed_data = json.loads(raw_text)

                # Ensure all values are allowed
                diet = parsed_data.get("diet")
                if diet not in ["meat_heavy", "flexitarian", "vegetarian", "vegan"]:
                    diet = None

                commute = parsed_data.get("commute")
                if commute not in ["drive", "transit", "two_wheeler", "walk"]:
                    commute = None

                housing = parsed_data.get("housing")
                if housing not in ["house", "apartment", "shared"]:
                    housing = None

                confidence = parsed_data.get("confidence")
                if confidence not in ["high", "low"]:
                    confidence = "low"

                return ParseResponse(
                    diet=diet,
                    commute=commute,
                    housing=housing,
                    confidence=confidence
                )
        except Exception as e:
            logger.warning(f"Gemini parsing failed with model {model}: {e}")
            last_error = e

    logger.error(f"All Gemini models failed for onboarding parse. Last error: {last_error}")
    return fallback_response
