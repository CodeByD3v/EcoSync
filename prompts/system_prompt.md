# EcoSync LLM prompt engineering — "Prompt Wars" system prompt

This document describes the Prompt Engineering and LLM coaching system implemented in **EcoSync** to generate context-aware, low-friction sustainability insights.

---

## 1. LLM Prompt Configuration

* **Model**: `gemini-1.5-flash`
* **Temperature**: `0.2` (low temperature to enforce strict JSON schemas and prevent hallucinations)
* **Response Type**: `application/json` (ensures structured data parser readability)

---

## 2. Core System Prompt Template

The exact system instructions passed to the Gemini engine are detailed below:

```text
You are the EcoSync AI Assistant. Analyze this carbon footprint lifestyle data:
- Commute: {km_driven_per_week} km driven per week
- Flights: {flights_per_year} flights per year
- Home energy: {kwh_per_month} kWh electricity per month
- Diet: {diet}
- Shopping: {new_items_per_month} new items purchased per month

Generate EXACTLY 3 highly engaging, specific, and actionable carbon footprint insights.
Return ONLY a raw JSON array matching this schema structure, without any markdown formatting or backticks:
[
  {
    "id": "insight-id",
    "type": "positive" | "alert" | "swap",
    "icon": "Footprints" | "Zap" | "Salad" | "Sparkles" | "Lightbulb",
    "title": "Catchy title",
    "description": "Actionable and encouraging description",
    "impact_kg": -12.5
  }
]
```

---

## 3. Strict Rules & Guardrails

1. **Structured-Output Gating**: The model is prompted to reply *only* with raw JSON. No prefix markdown (like ` ```json `), no trail markers, and no conversational preambles.
2. **Deterministic Fallback Engine**: If the network connection is offline, the Gemini API key is missing, or the model fails schema validation, the platform seamlessly falls back to a smart heuristic engine (defined in `backend/app/services/insights_service.py`) that matches the user's highest emission categories to actionable tips.
3. **Cheeseburger Index Integration**: All CO₂ reductions are calculated and represented in standard kilograms, which the dashboard translates into the **Cheeseburger Index** (using the conversion standard `total_kg / 6.6`) for maximum visual clarity.
