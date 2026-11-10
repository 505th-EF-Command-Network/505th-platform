/**
 * 505th Command Terminal — Firebase Auth stand-in.
 * Sign-in is the website's Discord session (HttpOnly cookie). `user.uid` is the
 * member's original terminal id, so every existing record still matches.
 */
const API = "/api/terminal/fs";
const AUTH = { type: "auth", currentUser: null };

export function getAuth() { return AUTH; }

async function whoami() {
  const res = await fetch(API, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ops: [{ op: "whoami" }] }),
  });
  if (res.status === 401) return null;
  if (res.status === 403) {
    window.location.href = "/boot";
    return null;
  }
  if (!res.ok) throw new Error(`Sign-in check failed (${res.status})`);
  const { results } = await res.json();
  return results?.[0]?.ok ? results[0].value : null;
}

export function onAuthStateChanged(auth, cb) {
  let active = true;
  whoami()
    .then((u) => {
      if (!active) return;
      AUTH.currentUser = u
        ? { uid: u.uid, email: u.email, displayName: u.displayName, discordId: u.discordId, getIdToken: async () => "" }
        : null;
      cb(AUTH.currentUser);
    })
    .catch((e) => {
      console.error("[terminal]", e.message);
      if (active) cb(null);
    });
  return () => { active = false; };
}

/** Ends the website session (same as the site's Sign out). */
export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", redirect: "manual" });
  AUTH.currentUser = null;
}
