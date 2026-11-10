/** 505th Command Terminal — Firebase App stand-in (no Firebase is loaded). */
const APP = { name: "[DEFAULT]", options: {} };
let initialised = false;

export function initializeApp() {
  initialised = true;
  return APP;
}

export function getApps() { return initialised ? [APP] : []; }
