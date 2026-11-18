/** True inside the PhysLive Android app: its WebView exposes the download bridge before the page runs. */
export const inAndroidApp = () => typeof window !== "undefined" && "PhysLiveDownload" in window;

/** Lets the stylesheets tell the app apart from a phone browser (no tap flash, no rubber-band scroll). */
export function markAndroidApp() {
  if (inAndroidApp()) document.documentElement.dataset.app = "android";
}
