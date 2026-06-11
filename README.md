# EcoSync — Carbon Footprint Awareness Platform

A premium, dark-mode dashboard that turns daily carbon data into action. Built
as a full-stack MVP:

- **Frontend:** React 18 + Vite, Tailwind CSS, Recharts, Lucide React
- **Backend:** Python + FastAPI
- **Deploy:** single-container Dockerfile for Google Cloud Run (or App Engine Flex)

```
ecosync/
├── backend/            FastAPI service (main.py, requirements.txt)
├── frontend/           React 18 dashboard (Vite + Tailwind)
├── Dockerfile          Builds frontend + backend into one image
├── app.yaml            App Engine Flexible config (alternative to Cloud Run)
└── README.md
```

## Features

- **Daily Impact gauge** — today's CO₂e with a trend indicator vs. yesterday.
- **Breakdown donut** — Home Energy / Transport / Food split.
- **AI Insights** — context-aware nudges and smart swaps.
- **Gamified checklist** — check off habits to earn points (persists per session in the API).

## Run locally

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173 (Vite proxies `/api` → `http://localhost:8000`).

> The dashboard ships with bundled demo data, so it still renders even if the
> API is offline.

## API

| Method | Path                          | Description                                   |
| ------ | ----------------------------- | --------------------------------------------- |
| GET    | `/api/v1/footprint/daily`     | Daily total, trend, and category breakdown    |
| GET    | `/api/v1/insights`            | AI nudges & smart swaps                        |
| GET    | `/api/v1/actions`             | Checklist items + completion state            |
| POST   | `/api/v1/actions/complete`    | Toggle an item, returns updated points total   |

## Deploy to GCP

The `Dockerfile` builds the React app and serves it from FastAPI, so the whole
platform runs as **one** service.

### Cloud Run (recommended)

```bash
gcloud run deploy ecosync \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### App Engine (Flexible)

```bash
gcloud app deploy app.yaml
```

### Local Docker

```bash
docker build -t ecosync .
docker run -p 8080:8080 ecosync
# open http://localhost:8080
```
