type AppBridge = { postMessage: (value: string) => void };

/**
 * Saves a file the page produced. A link cannot download inside the Android app's WebView, so there the file goes to
 * the app, which offers to share it; the session credentials never leave the page.
 */
export function saveFile(name: string, data: Blob) {
  const app = (window as unknown as { PhysLiveDownload?: AppBridge }).PhysLiveDownload;
  if (app) {
    const reader = new FileReader();
    reader.onload = () => app.postMessage(JSON.stringify({ name, type: data.type, data: String(reader.result).split(",")[1] }));
    reader.readAsDataURL(data);
    return;
  }
  const url = URL.createObjectURL(data), link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
