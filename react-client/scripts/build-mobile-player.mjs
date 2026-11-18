// Builds the simulation stage used by the Android app: the same sandboxed PixiJS runtime as the web player,
// packed into one offline HTML file. The app draws every control natively and only shows this page for the scene.
// Run from react-client: node scripts/build-mobile-player.mjs
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "../mobile-app/assets/player/player.html");

const bundled = await build({
  stdin: {
    contents: `export { PIXI_BRIDGE, PIXI_WORKER } from "./src/features/simulation/engine/pixiRuntime";
export { sampleTimeline } from "./src/features/simulation/model/svgScene";`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, format: "esm", platform: "neutral", write: false, minify: false,
});
const source = bundled.outputFiles[0].text;
const engine = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const pixi = readFileSync(resolve(root, "node_modules/pixi.js/dist/webworker.min.js"), "utf8");

const scriptJson = value => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
const stage = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; worker-src blob:; img-src blob: data:; style-src \'unsafe-inline\'; connect-src \'none\'; font-src \'none\';">'
  + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%;touch-action:none}</style>'
  + '</head><body><canvas></canvas><script>' + engine.PIXI_BRIDGE.replaceAll(/<\/script/gi, "<\\/script") + "</script></body></html>";
const runtime = "const sampleTimeline = (" + engine.sampleTimeline.toString() + ");\n" + engine.PIXI_WORKER;

// The host page: receives the scene from the app, starts it in the sandboxed frame and reports progress back.
// A srcdoc frame inherits this policy, so it has to allow what the stage needs: its blob worker and the generated code.
const host = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>PhysLive player</title>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; img-src blob: data:; frame-src 'self' about: blob: data:; style-src 'unsafe-inline'; connect-src 'none'">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}iframe{border:0;width:100%;height:100%;display:block;background:transparent}</style>
</head><body><script>
const STAGE = ${scriptJson(stage)};
const BUNDLE = ${scriptJson(pixi)};
const RUNTIME = ${scriptJson(runtime)};
const LIMITS = { maxCode: 250000, maxTextureSide: 4096, maxTexturePixels: 33554432, timeoutMs: 15000 };
let frame = null, lastTick = 0;
const toApp = message => { if (window.PhysLivePlayer) PhysLivePlayer.postMessage(JSON.stringify(message)); };
const toStage = message => frame && frame.contentWindow && frame.contentWindow.postMessage({ channel: 'pixi-host', ...message }, '*');
addEventListener('message', ({ source, data }) => {
  if (!frame || source !== frame.contentWindow || !data || data.channel !== 'pixi-runtime') return;
  // ticks arrive every frame; the app's clock and readouts need about fifteen a second
  if (data.type === 'tick') { const now = performance.now(); if (now - lastTick < 66) return; lastTick = now; }
  toApp({ type: data.type, t: data.t, message: data.message, sample: data.sample ? data.sample.fields : undefined });
});
window.physlive = {
  start(scene, controls) {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.onload = () => {
      toStage({ type: 'start', ...scene, limits: LIMITS, bundle: BUNDLE, runtime: RUNTIME });
      toStage({ type: 'speed', speed: controls.speed });
      toStage({ type: 'loop', loop: controls.loop });
      toStage({ type: 'play', playing: controls.playing });
    };
    frame.srcdoc = STAGE;
    document.body.appendChild(frame);
  },
  send(message) { toStage(message); },
};
toApp({ type: 'host' });
</script></body></html>`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, host);
console.log("Wrote", target, Math.round(host.length / 1024) + " KiB");
