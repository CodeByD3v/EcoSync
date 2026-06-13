// Tiny API client for the EcoSync backend.
//
// In development Vite proxies `/api` to the FastAPI server (see
// vite.config.js). In production the frontend is served from the same origin
// as the API, so a relative base works there too. Override with
// VITE_API_BASE_URL when the API lives on a different host.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}`)
  }
  return res.json()
}

export const getDailyFootprint = () => request('/footprint/daily')

export const getInsights = () => request('/insights')

export const getActions = () => request('/actions')

export const completeAction = (actionId, completed) =>
  request('/actions/complete', {
    method: 'POST',
    body: JSON.stringify({ action_id: actionId, completed }),
  })

export const submitOnboarding = (payload) =>
  request('/onboard', { method: 'POST', body: JSON.stringify(payload) })

export const parseOnboarding = (message) =>
  request('/onboard/parse', { method: 'POST', body: JSON.stringify({ message }) })

// New endpoints for calculation, profile settings and community challenges
export const calculateFootprint = (payload) =>
  request('/footprint/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getUserProfile = () => request('/footprint/profile')

export const getChallenges = () => request('/actions/challenges')

export const triggerTelemetryTick = (eventType) =>
  request('/footprint/telemetry-tick', {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType }),
  })
