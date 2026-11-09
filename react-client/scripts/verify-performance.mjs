import { build, preview } from "vite";
import react from "@vitejs/plugin-react-swc";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";

// A production build with env files disabled. Every API below is a fixture; no real credentials or DB.
const outDir = await mkdtemp(path.join(os.tmpdir(), "physlive-performance-"));
let chunks = [];
await build({ configFile: false, envFile: false, plugins: [react(), { name: "performance-sizes", generateBundle(_, bundle) {
  chunks = Object.values(bundle).filter(item => item.type === "chunk").map(item => ({ file: item.fileName,
    bytes: Buffer.byteLength(item.code), gzip: gzipSync(item.code).length, imports: item.imports,
    modules: Object.keys(item.modules).filter(id => id.includes("/src/")).map(id => id.split("/src/")[1]) }));
} }], build: { outDir, emptyOutDir: false }, logLevel: "warn" });
const streams = new Set();
const server = await preview({ configFile: false, envFile: false, build: { outDir },
  preview: { host: "127.0.0.1", port: 5197, strictPort: true }, plugins: [{ name: "fixture-events", configurePreviewServer(app) {
    app.middlewares.use("/api/realtime/events", (request, response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      response.write("event: ready\ndata: 1\n\n"); streams.add(response);
      request.on("close", () => streams.delete(response));
    });
  } }] });
const url = "http://127.0.0.1:5197";
const browser = await chromium.launch({ headless: true }).catch(() => chromium.launch({ channel: "chrome", headless: true }));
const fixtureToken = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") + "."
  + Buffer.from(JSON.stringify({ sub: "public-fixture", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".not-a-signature";
const schoolId = "10000000-0000-0000-0000-000000000001";
const results = [];
let revision = 1;
function emit(apiPath) { for (const response of streams) response.write("event: change\ndata: " + JSON.stringify({ revision: ++revision, path: apiPath, clientId: "external-fixture" }) + "\n\n"); }
const people = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, fullName: "Student " + String(index + 1).padStart(2, "0"),
  email: "student" + (index + 1) + "@test.invalid", role: "STUDENT", schoolId, schoolName: "Fixture school", active: true, accountStatus: "ACTIVE", permissions: [] }));
const classrooms = Array.from({ length: 12 }, (_, index) => ({ id: "20000000-0000-0000-0000-" + String(index + 1).padStart(12, "0"),
  name: "Class " + String(index + 1).padStart(2, "0"), gradeLevel: 10, schoolYear: "2026-2027", subject: "Fixture Physics", active: true, teacherCount: 1, studentCount: 27 }));
const accounts = { total: 12, STUDENT: 12, suspended: 0 };
const actor = role => ({ id: role === "SCHOOL" ? 101 : role === "STUDENT" ? 102 : 100, email: role.toLowerCase() + "@test.invalid",
  fullName: "Fixture " + role, role, active: true, accountStatus: "ACTIVE", permissions: [], mustChangePassword: false,
  schoolId: role === "MANAGER" ? null : schoolId, schoolName: "Fixture school", billingRequired: false });
async function fixture(role, openPath, delayRecent = false) {
  let releaseRoster; const rosterGate = new Promise(resolve => { releaseRoster = resolve; });
  const context = await browser.newContext(); const requests = [], errors = []; let current = actor(role);
  await context.addInitScript(token => localStorage.setItem("token", token), fixtureToken);
  await context.route("**/api/**", async route => {
    const parsed = new URL(route.request().url()), api = parsed.pathname;
    requests.push(api + parsed.search);
    if (api === "/api/realtime/events") return route.continue();
    let data = [];
    if (api === "/api/user/me") data = current;
    else if (api === "/api/auth/login") { current = actor("STUDENT"); data = { token: fixtureToken + "-second", user: current }; }
    else if (api === "/api/user/me/license") data = { active: true, canPerformWriteOperations: true, showRenewalBanner: false };
    else if (api.endsWith("/users/page")) {
      const query = (parsed.searchParams.get("query") ?? "").toLowerCase(), page = Number(parsed.searchParams.get("page")), size = Number(parsed.searchParams.get("size"));
      const items = people.filter(item => (item.fullName + " " + item.email).toLowerCase().includes(query));
      data = { items: items.slice(page * size, (page + 1) * size), totalElements: items.length, totalPages: Math.ceil(items.length / size), page, size, counts: accounts };
    } else if (api === "/api/admin/schools/page") data = { items: [{ id: schoolId, code: "FIXTURE", name: "Fixture school", address: "Fixture", active: true, planCode: "STARTER", subscriptionStatus: "ACTIVE" }], totalElements: 1, totalPages: 1, page: 0, size: 10 };
    else if (api === "/api/support/inbox/pending-count") data = { count: 2 };
    else if (api === "/api/support/inbox") data = { support: [], appeals: [], totalElements: 0, totalPages: 0, page: 0 };
    else if (api.endsWith("/classes/page")) {
      const page = Number(parsed.searchParams.get("page")), size = Number(parsed.searchParams.get("size"));
      if (delayRecent && size === 5) await rosterGate;
      data = { items: classrooms.slice(page * size, (page + 1) * size), totalElements: 12, totalPages: Math.ceil(12 / size), page, size, years: ["2026-2027"], totalClasses: 12, activeClasses: 12 };
    } else if (api.endsWith("/overview")) data = { ...classrooms.find(item => api.includes(item.id)), teachers: [{ id: 200, fullName: "Fixture teacher", email: "teacher@test.invalid" }], studentCount: 27 };
    else if (api.endsWith("/reports/summary")) data = { schoolId, schoolName: "Fixture school", students: 12, teachers: 1, managers: 1, activeClasses: 12, enrolledStudents: 12, usedTokens: 0, tokenQuota: 1000, licenseEnd: "2030-01-01" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  await page.goto(url + openPath);
  return { context, page, requests, errors, releaseRoster };
}
try {
  const manager = await fixture("MANAGER", "/manager/users");
  const { page, requests } = manager;
  await expect(page.getByText("Student 01", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(page.getByText("Student 11", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  assert.ok(requests.some(request => request.includes("page=1") && request.includes("size=10")));
  await page.getByRole("button", { name: "Trước", exact: true }).click();
  await expect(page.getByText("Student 01", { exact: true })).toBeVisible();
  assert.equal(requests.filter(request => request.includes("/users/page?page=0")).length, 1);
  await page.getByRole("searchbox").fill("Student 11");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("Student 11", { exact: true })).toBeVisible();
  results.push("Manager: server pagination, totals, search and cache on previous page PASS");
  assert.ok(!requests.includes("/api/admin/users"));
  assert.ok(!requests.includes("/api/admin/schools"));
  assert.equal(manager.errors.length, 0, manager.errors.join("\n"));
  await page.getByRole("link", { name: "Trường học", exact: true }).click();
  await page.getByRole("button", { name: "Xem lớp học", exact: true }).click();
  const classes = page.getByRole("dialog");
  await expect(classes.getByText("Class 01", { exact: true })).toBeVisible();
  await expect(classes.locator("tbody tr")).toHaveCount(10);
  await classes.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(classes.locator("tbody tr")).toHaveCount(2);
  await classes.getByRole("button", { name: "Xem lớp Class 11", exact: true }).click();
  await expect(classes.getByText("Fixture teacher", { exact: true })).toBeVisible();
  assert.equal(await classes.getByRole("button", { name: /Phân công|Tắt|Gỡ/ }).count(), 0);
  results.push("Manager class dialog: server pagination, teacher detail and read-only actions PASS");
  await manager.context.close();

  const school = await fixture("SCHOOL", "/school/users");
  await expect(school.page.getByText("Student 01", { exact: true })).toBeVisible();
  await school.page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  const name = school.page.getByRole("dialog").getByLabel("Họ và tên", { exact: true });
  await name.fill("Unsaved fixture name");
  await expect.poll(() => streams.size).toBeGreaterThan(0);
  const before = school.requests.filter(request => request.includes("/users/page")).length;
  emit("/api/admin/users/7/restore");
  await expect.poll(() => school.requests.filter(request => request.includes("/users/page")).length).toBeGreaterThan(before);
  await expect(name).toHaveValue("Unsaved fixture name");
  await expect(school.page.getByRole("dialog")).toBeVisible();
  results.push("School: scoped endpoint and realtime keeps unsaved modal state PASS");
  await school.page.getByRole("button", { name: "Hủy", exact: true }).click();
  await school.page.getByRole("button", { name: "Tài khoản Fixture SCHOOL", exact: true }).click();
  await school.page.getByText("Đăng xuất", { exact: true }).click();
  await expect(school.page.locator('input[type="email"]')).toBeVisible();
  await school.page.locator('input[type="email"]').fill("student@test.invalid");
  await school.page.locator('input[type="password"]').fill("fixture-password");
  await school.page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(school.page).toHaveURL(/\/student$/);
  await expect(school.page.getByRole("link", { name: "Bài tập được giao" })).toBeVisible();
  assert.equal(await school.page.getByText("Student 01", { exact: true }).count(), 0);
  assert.equal(school.errors.length, 0, school.errors.join("\n"));
  results.push("Logout and second-account login: old account rows cleared PASS");
  await school.context.close();

  const dashboard = await fixture("SCHOOL", "/school", true);
  await expect(dashboard.page.getByText("Học sinh đang hoạt động", { exact: true })).toBeVisible();
  assert.equal(await dashboard.page.getByText("Trường chưa có lớp đang hoạt động.", { exact: true }).count(), 0);
  assert.equal(dashboard.requests.filter(request => request === "/api/user/me/license").length, 1);
  dashboard.releaseRoster();
  await expect(dashboard.page.getByText("Class 01", { exact: true })).toBeVisible();
  assert.equal(dashboard.errors.length, 0, dashboard.errors.join("\n"));
  results.push("School dashboard: summary is visible while classes load; licence request deduplicated PASS");
  await dashboard.context.close();

  const student = await fixture("STUDENT", "/student");
  await expect(student.page.getByRole("link", { name: "Bài tập được giao" })).toBeVisible();
  await expect.poll(() => student.requests.some(request => request.includes("/assignments/mine/student"))).toBe(true);
  assert.equal(student.requests.some(request => request.includes("/library")), false);
  const js = await student.page.evaluate(() => performance.getEntriesByType("resource").filter(item => /\.js/.test(item.name)).map(item => item.name));
  assert.equal(js.some(file => /\/simulation-[^/]+\.js/.test(file)), false);
  assert.equal(student.errors.length, 0, student.errors.join("\n"));
  results.push("Student overview: no eager community request and no Pixi engine download PASS");
  await student.context.close();
  console.log(results.join("\n"));
  const main = chunks.find(chunk => chunk.file.match(/assets\/index-[^/]+\.js/) && chunk.modules.includes("main.tsx"));
  const studentChunk = chunks.find(chunk => chunk.modules.includes("features/assignments/pages/StudentAssignments.tsx"));
  const compact = chunk => chunk && ({ file: chunk.file, bytes: chunk.bytes, gzip: chunk.gzip, imports: chunk.imports });
  console.log("BUNDLE_RESULT", JSON.stringify({ main: compact(main), student: compact(studentChunk), heavy: chunks.filter(chunk => chunk.bytes > 250000).map(compact) }));
  await writeFile(path.join(outDir, "verification.json"), JSON.stringify({ results, chunks }, null, 2));
  console.log("VERIFICATION_ARTIFACT", outDir);
} finally {
  await browser.close();
  for (const response of streams) response.end();
  await new Promise(resolve => server.httpServer.close(resolve));
}
