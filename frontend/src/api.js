// Tiny API client for the EcoSync backend.
//
// In development Vite proxies `/api` to the FastAPI server (see
// vite.config.js). In production the frontend is served from the same origin
// as the API, so a relative base works there too. Override with
// VITE_API_BASE_URL when the API lives on a different host.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const REQUEST_TIMEOUT_MS = 10000  // 10 second timeout for all API calls

async function request(path, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE_URL}/api/v1${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail?.detail || `Request to ${path} failed with status ${res.status}`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${path} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
    }
    throw err
  }
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

export const calculateFootprint = (payload) =>
  request('/footprint/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getUserProfile = () => request('/footprint/profile')

export const getChallenges = () => request('/actions/challenges')

export const getConnectorStatus = () => request('/footprint/connectors')

export const syncFootprintFromConnectors = (payload) =>
  request('/footprint/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getLocationContext = (lat, lng) =>
  request('/location/context', {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  })

export const resolvePincode = (zipCode) =>
  request('/location/pincode', {
    method: 'POST',
    body: JSON.stringify({ zip_code: zipCode }),
  })

export const getMapsConfig = () => request('/location/maps-config')

export const getNeighborhoodComparison = (payload) =>
  request('/location/neighborhood', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
