# ---------------------------------------------------------------------------
# EcoSync — single-image build for Google Cloud Run.
#
# Stage 1 compiles the React dashboard. Stage 2 installs the FastAPI backend
# and copies the built frontend into ./static so one service serves both the
# API (/api/v1/*) and the SPA. Cloud Run injects $PORT at runtime.
# ---------------------------------------------------------------------------

# Stage 1: build the frontend
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend + bundled static frontend
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./static

EXPOSE 8080
# Use the shell form so $PORT (set by Cloud Run) is expanded at runtime.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
