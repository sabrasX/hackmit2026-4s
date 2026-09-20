// The last finished session, kept per user so signing in as someone else
// never shows the previous child's results.

const PREFIX = 'lastSession:'

function key(uid) {
  return `${PREFIX}${uid || 'anonymous'}`
}

export function saveLastSession(uid, session) {
  try {
    sessionStorage.setItem(key(uid), JSON.stringify({ ...session, uid: uid || 'anonymous' }))
  } catch {
    // storage full or blocked: the results page just shows "no session found"
  }
}

export function loadLastSession(uid) {
  try {
    const raw = sessionStorage.getItem(key(uid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearLastSessions() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k))
    sessionStorage.removeItem('lastSession') // written by older builds
  } catch {
    // nothing to clean up
  }
}
