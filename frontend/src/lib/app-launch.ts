// Tells a tap on the home-screen icon apart from navigating inside the app.
//
// Icons added before the Home page existed still open /dashboard/scan: an
// iPhone freezes the start_url when the icon is added, and Android only picks
// up a new manifest after a while. The scan page asks isFreshAppLaunch() and
// forwards such a launch to Home, so nobody has to re-add the icon.

const KEY = "app-session-started";

/** True on the first page of an installed-app session (sessionStorage starts empty on each launch). */
export function isFreshAppLaunch(): boolean {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  try {
    return standalone && !sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}

/** Called once the app is up — later scan visits are real taps. */
export function markAppSessionStarted() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // No session storage: no load ever counts as a fresh launch.
  }
}
