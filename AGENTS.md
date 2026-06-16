# EcoSync Agents Architecture

This document outlines the AI agents and intelligent systems that power **EcoSync**, detailing their roles, implementations, and system prompts. The agents are designed to reduce user friction, gamify sustainability, and provide hyper-personalized insights without causing "climate anxiety."

---

## 1. AI Onboarding Coach

**Role**: An empathetic, conversational agent designed to establish a user's initial carbon baseline seamlessly.

**Location / Reference**: `prompts/system_prompt.md` and Frontend Wizard.

**Purpose**: 
Traditional carbon trackers fail due to manual, high-friction data entry. The Onboarding Coach replaces forms with a conversation. It gently asks the user about their lifestyle to extract three core parameters:
*   **Diet**: (`meat_heavy`, `mixed`, `flexitarian`, `vegetarian`, `vegan`)
*   **Commute**: (`drive`, `transit`, `two_wheeler`, `walk`)
*   **Housing**: (`house`, `apartment`, `shared`)

**Rules of Engagement**:
1.  Ask only **one question at a time** to prevent cognitive overload.
2.  Maintain a non-judgmental, encouraging, and clear tone.
3.  Parse descriptive natural language answers and map them directly into standardized backend categories.
4.  Output the final profile state as a structured JSON object.

---

## 2. EcoSync AI Assistant (Insights Agent)

**Role**: A data-driven agent that generates actionable, context-aware sustainability tips (Smart Swaps) based on real-time telemetry.

**Implementation**: `backend/app/services/insights_service.py`

**Model Engine**: Gemini 1.5 Flash (with fallback options to 2.5/3.5).

**Purpose**: 
This agent runs in the background and analyzes the user's live carbon footprint data (e.g., kilometers driven, flights taken, kWh consumed, diet). It then produces **exactly 3** highly engaging and specific insights tailored to the user's highest emission categories.

**Output Constraints**:
The Insights Agent is strictly constrained by a zero-temperature generation prompt to return a purely raw, valid JSON array matching the frontend schemas:
*   `type`: Must be `positive`, `alert`, or `swap`.
*   `icon`: Must match standard frontend icons (`Footprints`, `Zap`, `Salad`, etc.).
*   `impact_kg`: A quantifiable estimate of CO₂ reduction.

**System Prompt Snippet**:
```text
You are the EcoSync AI Assistant. Analyze this carbon footprint lifestyle data...
Generate EXACTLY 3 highly engaging, specific, and actionable carbon footprint insights.
Return ONLY a raw JSON array matching this schema structure, without any markdown formatting...
```

---

## 3. Heuristic Fallback Engine

**Role**: A deterministic safety net ensuring the application remains functional even when generative AI services are offline.

**Implementation**: `backend/app/services/insights_service.py` (`_get_fallback_insights()`)

**Purpose**: 
If the Google Gemini API key is missing, network requests timeout, or the model hallucinates non-compliant JSON schemas, EcoSync seamlessly hands over control to the Fallback Engine. 

This engine provides a set of pre-calculated, hardcoded actionable swaps (e.g., "Peak Hours Alert", "Swap Beef for Lentils") that guarantee a continuous and premium user experience without disrupting the dashboard interface.
