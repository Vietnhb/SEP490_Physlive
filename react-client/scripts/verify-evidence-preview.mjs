import { createServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import { chromium } from "playwright";
import { expect } from "@playwright/test";

// Exercise development StrictMode effect replay; production builds cannot reproduce this regression.
const moduleId = "/@evidence-preview-test";
const source = `
import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppealEvidencePicker } from "/src/features/account/components/AppealEvidence.tsx";
const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII="), c => c.charCodeAt(0));
const file = new File([bytes], "strict-mode-proof.png", { type: "image/png" });
function Harness() {
  const [disabled, setDisabled] = useState(false);
  window.setEvidenceDisabled = setDisabled;
  return React.createElement(AppealEvidencePicker, { files: [file], onChange() {}, disabled });
}
createRoot(document.getElementById("root")).render(React.createElement(StrictMode, null, React.createElement(Harness)));
`;
const server = await createServer({ configFile: false, envFile: false, plugins: [react(), {
  name: "evidence-preview-fixture",
  resolveId(id) { if (id === moduleId) return id; },
  load(id) { if (id === moduleId) return source; },
  configureServer(app) {
    app.middlewares.use("/preview-check", async (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(await app.transformIndexHtml("/preview-check", `<html><body><div id="root"></div><script type="module" src="${moduleId}"></script></body></html>`));
    });
  },
}], server: { host: "127.0.0.1", port: 5198, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ headless: true }).catch(() => chromium.launch({ channel: "chrome", headless: true }));
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5198/preview-check");
  const image = page.getByRole("img", { name: "strict-mode-proof.png", exact: true });
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => window.setEvidenceDisabled(true));
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  console.log("Development StrictMode: image remains decoded after effect replay and submit-state update PASS");
} finally { await browser.close(); await server.close(); }
