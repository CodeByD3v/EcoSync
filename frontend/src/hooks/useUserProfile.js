import { useCallback, useState } from 'react'

// Persists the user's onboarding profile in localStorage so the dashboard is
// only gated behind onboarding once. Reading/writing localStorage keeps the
// flow working even when the backend is offline.
const STORAGE_KEY = 'ecosync_profile'

function readProfile() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useUserProfile() {
  const [profile, setProfile] = useState(readProfile)

  const saveProfile = useCallback((next) => {
    setProfile(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore write failures (e.g. storage disabled) — the in-memory profile
      // still drives the current session.
    }
  }, [])

  const clearProfile = useCallback(() => {
    setProfile(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore — nothing else to do if storage is unavailable.
    }
  }, [])

  return { profile, saveProfile, clearProfile }
}

export default useUserProfile
