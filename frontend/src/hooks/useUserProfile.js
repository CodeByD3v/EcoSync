import { useCallback, useState } from 'react'

// Persists the user's onboarding profile in localStorage so the dashboard is
// only gated behind onboarding once. Reading/writing localStorage keeps the
// flow working even when the backend is offline.
//
// Note: The XOR + base64 below is lightweight OBFUSCATION, not encryption.
// It prevents casual inspection of localStorage but is not cryptographically secure.
// Profile data contains no secrets (name, city, diet preference) so this is acceptable.
const STORAGE_KEY = 'ecosync_profile'
const ENCRYPTION_KEY = 'ecosync_secure_key_12983'

function encrypt(text) {
  let xored = ''
  for (let i = 0; i < text.length; i++) {
    xored += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
  }
  return btoa(encodeURIComponent(xored).replace(/%([0-9A-F]{2})/g, function(match, p1) {
    return String.fromCharCode(parseInt(p1, 16))
  }))
}

function decrypt(cipher) {
  try {
    const xored = decodeURIComponent(Array.prototype.map.call(atob(cipher), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    let result = ''
    for (let i = 0; i < xored.length; i++) {
      result += String.fromCharCode(xored.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length))
    }
    return result
  } catch (err) {
    return null
  }
}

function readProfile() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    // Support transition: if it's plaintext JSON, parse it; otherwise decrypt it.
    if (raw.startsWith('{')) {
      return JSON.parse(raw)
    }
    const decrypted = decrypt(raw)
    return decrypted ? JSON.parse(decrypted) : null
  } catch {
    return null
  }
}

export function useUserProfile() {
  const [profile, setProfile] = useState(readProfile)

  const saveProfile = useCallback((next) => {
    setProfile(next)
    try {
      const obfuscated = encrypt(JSON.stringify(next))
      window.localStorage.setItem(STORAGE_KEY, obfuscated)
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
