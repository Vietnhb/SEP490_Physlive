import { build, preview } from "vite";
import react from "@vitejs/plugin-react-swc";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
function emit(apiPath, clientId = "external-fixture") { for (const response of streams) response.write("event: change\ndata: " + JSON.stringify({ revision: ++revision, path: apiPath, clientId }) + "\n\n"); }
let onAppealCreated = () => { };
const people = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, fullName: "Student " + String(index + 1).padStart(2, "0"),
  email: "student" + (index + 1) + "@test.invalid", role: "STUDENT", schoolId, schoolName: "Fixture school", active: true, accountStatus: "ACTIVE", permissions: [] }));
const classrooms = Array.from({ length: 12 }, (_, index) => ({ id: "20000000-0000-0000-0000-" + String(index + 1).padStart(12, "0"),
  name: "Class " + String(index + 1).padStart(2, "0"), gradeLevel: 10, schoolYear: "2026-2027", subject: "Fixture Physics", active: true, teacherCount: 1, studentCount: 27 }));
const accounts = { total: 12, STUDENT: 12, suspended: 0 };
const actor = role => ({ id: role === "SCHOOL" ? 101 : role === "STUDENT" ? 102 : 100, email: role.toLowerCase() + "@test.invalid",
  fullName: "Fixture " + role, role, active: true, accountStatus: "ACTIVE", permissions: role === "STAFF" ? ["TEACH"] : role === "REVIEWER" ? ["CONTENT_EDIT", "CONTENT_REVIEW"] : [], mustChangePassword: false,
  schoolId: role === "MANAGER" ? null : schoolId, schoolName: "Fixture school", billingRequired: false });
async function fixture(role, openPath, delayRecent = false, handover = false, appealMode = false, emptyInbox = false, teacherClassMode = false, complaintDateMode = false) {
  let releaseRoster; const rosterGate = new Promise(resolve => { releaseRoster = resolve; });
  const context = await browser.newContext(); const requests = [], errors = []; let current = actor(role);
  if (appealMode && role === "STAFF") current = { ...current, active: false, accountStatus: "SUSPENDED_READ_ONLY" };
  let appealSent = role === "SCHOOL" && !emptyInbox;
  let appeal = { id: "30000000-0000-0000-0000-000000000001", userId: 100, userName: "Fixture STAFF", userEmail: "staff@test.invalid", reason: "Unlock fixture account", content: "Please review the evidence", status: "PENDING", authority: "SCHOOL", canResolve: true, currentSuspension: true, createdAt: "2026-11-14T07:00:00Z" };
  let reportRevision = 0, failPath = "", holdPath = "", heldResponse;
  const writes = [], history = [];
  let assignedTeacher = { id: 200, fullName: "Fixture teacher", email: "teacher@test.invalid" };
  const nextTeacher = { id: 201, fullName: "Next teacher", email: "next@test.invalid", role: "STAFF", active: true, permissions: ["TEACH"] };
  let submission = { id: "submission-1", assignmentId: "assignment-1", studentId: 1, studentName: "Student 01", predictions: { answerText: "Initial prediction", reasoning: "Measurement reasoning", conclusion: "Long conclusion " + "Measured result and explanation. ".repeat(120) + "END OF FULL CONCLUSION" }, completedAt: "2026-11-01T10:00:00Z", score: 8, maxScore: 10, feedback: "Original feedback", gradingStatus: "TEACHER_CONFIRMED", gradedById: 200, gradedByName: "Fixture teacher" };
  await context.addInitScript(token => localStorage.setItem("token", token), fixtureToken);
  await context.route("**/api/**", async route => {
    const parsed = new URL(route.request().url()), api = parsed.pathname;
    requests.push(api + parsed.search);
    const method = route.request().method();
    if (method !== "GET") writes.push({ api, method, body: route.request().postData() ? route.request().headers()["content-type"]?.includes("multipart/") ? route.request().postData() : route.request().postDataJSON() : null });
    if (api === "/api/realtime/events") return route.continue();
    if (api === holdPath) { holdPath = ""; await heldResponse; }
    if (api === failPath) { failPath = ""; return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Fixture refresh failed" }) }); }
    let data = [];
    if (api === "/api/user/me") data = current;
    else if (complaintDateMode && api === "/api/support/mine") data = Array.from({ length: 23 }, (_, index) => ({ id: String(index + 1).padStart(8, "0") + "-fixture", kind: "COMPLAINT", subject: "Báo lỗi " + (index + 1), content: (index === 22 ? "Kết luận dài. ".repeat(100) + "END FULL COMPLAINT" : "Nội dung ngắn") + "\n— Đề bài —\nĐề bài đầy đủ\n— Thông số đang dùng —\nv = 15 m/s", status: ["OPEN", "READ", "RESOLVED"][index % 3], createdAt: new Date(Date.UTC(2026, 10, index + 1, 8)).toISOString(), responderName: "Reviewer", adminResponse: index === 22 ? "Phản hồi đầy đủ" : null }));
    else if (complaintDateMode && api === "/api/support/inbox") {
      const from = parsed.searchParams.get("from"), to = parsed.searchParams.get("to"), status = parsed.searchParams.get("status"), query = parsed.searchParams.get("query") ?? "";
      const rows = Array.from({ length: 23 }, (_, index) => ({ id: String(index + 1).padStart(8, "0") + "-fixture", userId: index + 1, userName: "Teacher " + (index + 1), userEmail: "teacher" + (index + 1) + "@test.invalid", reason: "Yêu cầu " + (index + 1), content: "School appeal details", status: ["PENDING", "APPROVED", "REJECTED"][index % 3], authority: "SCHOOL", canResolve: true, createdAt: new Date(Date.UTC(2026, 10, index + 1, 8)).toISOString() })).reverse().filter(item => (!from || item.createdAt.slice(0, 10) >= from) && (!to || item.createdAt.slice(0, 10) <= to) && (status === "ALL" || (status === "TODO" ? item.status === "PENDING" : item.status !== "PENDING")) && (item.userName + " " + item.reason).toLowerCase().includes(query.toLowerCase()));
      const size = Number(parsed.searchParams.get("size") || 10), totalPages = Math.ceil(rows.length / size), page = Math.min(Number(parsed.searchParams.get("page") || 0), Math.max(0, totalPages - 1));
      data = { support: [], appeals: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages, page };
    }
    else if (teacherClassMode && api === "/api/assignments/mine/teacher/classes") data = [{ ...classrooms[0], students: people.slice(0, 3) }, { ...classrooms[1], students: people.slice(10, 12) }];
    else if (teacherClassMode && api === "/api/assignments/mine/teacher") data = [{ id: "assignment-1", classId: classrooms[0].id, className: classrooms[0].name, title: "Fixture assignment", studentIds: [1, 2, 3, 4], status: "ACTIVE", maxScore: 10, questions: {}, assignedAt: "2026-11-01T10:00:00Z" }, { id: "assignment-other", classId: classrooms[1].id, className: classrooms[1].name, title: "Other class assignment", studentIds: [11, 12], status: "ACTIVE", questions: {}, assignedAt: "2026-11-01T10:00:00Z" }];
    else if (teacherClassMode && api.endsWith("/grades.csv")) return route.fulfill({ status: 200, contentType: "text/csv; charset=UTF-8", body: "\uFEFFHọc sinh,Điểm\r\nStudent 01,8\r\nStudent 02,\r\nStudent 03,\r\nFormer student,0\r\n" });
    else if (api.endsWith("/grades/page")) {
      const source = gradebookFixture();
      if (teacherClassMode) source.students = source.students.map(student => student.id !== 1 ? student : { ...student, cells: student.cells.map(cell => cell.assignmentId === "assignment-1" ? { ...cell, score: submission.score, feedback: submission.feedback, state: submission.gradingStatus, submissionId: submission.id } : cell) });
      data = pageGradebook(source, parsed);
    }
    else if (teacherClassMode && api.endsWith("/grades")) {
      data = gradebookFixture(); data.students = data.students.map(student => student.id !== 1 ? student : { ...student, cells: student.cells.map(cell => cell.assignmentId === "assignment-1" ? { ...cell, score: submission.score, feedback: submission.feedback, state: submission.gradingStatus, submissionId: submission.id } : cell) });
    }
    else if (teacherClassMode && api === "/api/library/mine") data = [{ id: "library-fixture", simulationId: "simulation-fixture", title: "Fixture simulation", validationStatus: "PASSED", visibility: "PERSONAL", createdAt: "2026-11-01T10:00:00Z" }];
    else if (teacherClassMode && api.includes("/simulations/simulation-fixture")) data = { simulationId: "simulation-fixture", time: [0, 1], parameters: {}, visualization: { controls: [], series: [] }, validation: { passed: true, checkpoints: [] } };
    else if (teacherClassMode && api === "/api/assignments" && method === "POST") data = { id: "created-fixture" };
    else if (api === "/api/admin/validation-runs/topics") data = ["KINEMATICS", "DYNAMICS"];
    else if (api === "/api/schemas/topic-names") data = [{ topic: "KINEMATICS", name: "Động học" }, { topic: "DYNAMICS", name: "Động lực học" }];
    else if (api === "/api/admin/validation-runs/page") {
      const all = Array.from({ length: 37 }, (_, index) => ({ id: "validation-" + index, topic: index % 2 ? "DYNAMICS" : "KINEMATICS", passed: index % 3 !== 0, createdAt: new Date(Date.UTC(2026, 10, index + 1, 10)).toISOString(), schemaVersion: "1.0", errorMessage: index % 3 ? null : "Fixture failed check" }));
      const topic = parsed.searchParams.get("topic"), status = parsed.searchParams.get("status"), from = parsed.searchParams.get("from"), to = parsed.searchParams.get("to");
      const matches = all.filter(item => (!topic || item.topic === topic) && (!status || status === "ALL" || item.passed === (status === "PASS")) && (!from || item.createdAt.slice(0, 10) >= from) && (!to || item.createdAt.slice(0, 10) <= to));
      const page = Number(parsed.searchParams.get("page") || 0), size = Number(parsed.searchParams.get("size") || 10);
      data = { items: matches.slice(page * size, (page + 1) * size), totalElements: matches.length, totalPages: Math.ceil(matches.length / size), page, size };
    }
    else if (api === "/api/auth/login") { current = actor("STUDENT"); data = { token: fixtureToken + "-second", user: current }; }
    else if (api === "/api/user/me/license") data = { active: true, canPerformWriteOperations: true, showRenewalBanner: false };
    else if (api.endsWith("/users/page")) {
      const query = (parsed.searchParams.get("query") ?? "").toLowerCase(), page = Number(parsed.searchParams.get("page")), size = Number(parsed.searchParams.get("size"));
      const schoolScope = api.startsWith("/api/schools/");
      const source = schoolScope ? [...people, { ...actor("SCHOOL"), dateOfBirth: "1980-01-02" }] : people;
      const roleFilter = parsed.searchParams.get("role") || "ALL";
      const items = source.filter(item => (roleFilter === "ALL" || roleFilter === item.role) && (item.fullName + " " + item.email).toLowerCase().includes(query));
      data = { items: items.slice(page * size, (page + 1) * size), totalElements: items.length, totalPages: Math.ceil(items.length / size), page, size, counts: schoolScope ? { ...accounts, total: 13, SCHOOL: 1 } : accounts };
    } else if (api === "/api/admin/schools/page") data = { items: [{ id: schoolId, code: "FIXTURE", name: "Fixture school", address: "Fixture", active: true, planCode: "STARTER", subscriptionStatus: "ACTIVE" }], totalElements: 1, totalPages: 1, page: 0, size: 10 };
    else if (api === "/api/support/inbox/pending-count") data = { count: appealMode ? Number(appealSent && appeal.status === "PENDING") : 2, revision };
    else if (appealMode && api === "/api/appeals" && method === "POST") { appealSent = true; data = appeal; onAppealCreated(); emit("/api/appeals", route.request().headers()["x-physlive-client"]); }
    else if (appealMode && api === "/api/appeals/my") data = appealSent ? [appeal] : [];
    else if (appealMode && api.endsWith("/evidence")) data = [{ id: "40000000-0000-0000-0000-000000000001", contentType: "image/png" }];
    else if (appealMode && api.includes("/evidence/")) return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=", "base64") });
    else if (appealMode && api.endsWith("/resolve")) { appeal = { ...appeal, ...route.request().postDataJSON(), canResolve: false }; data = appeal; }
    else if (api === "/api/support/inbox") data = { support: [], appeals: appealMode && appealSent ? [appeal] : [], totalElements: appealMode && appealSent ? 1 : 0, totalPages: appealMode && appealSent ? 1 : 0, page: 0 };
    else if (api.endsWith("/classes/page")) {
      const page = Number(parsed.searchParams.get("page")), size = Number(parsed.searchParams.get("size"));
      if (delayRecent && size === 5) await rosterGate;
      data = { items: classrooms.slice(page * size, (page + 1) * size), totalElements: 12, totalPages: Math.ceil(12 / size), page, size, years: ["2026-2027"], totalClasses: 12, activeClasses: 12 };
    } else if (api.endsWith("/overview")) data = { ...classrooms.find(item => api.includes(item.id)), teachers: [{ id: 200, fullName: "Fixture teacher", email: "teacher@test.invalid" }], studentCount: 27 };
    else if (api.endsWith("/reports/summary")) data = { schoolId, schoolName: "Fixture school", students: 12 + reportRevision, teachers: 1, managers: 1, activeClasses: 12, enrolledStudents: 12, usedTokens: reportRevision, tokenQuota: 1000, studentQuota: 100, planCode: "STARTER", licenseStart: "2026-01-01", licenseEnd: "2030-01-01", licenseStatus: "ACTIVE", usageMonth: "2026-11-01" };
    else if (api.endsWith("/reports/classes")) data = classrooms.map(item => ({ ...item, teachers: 1, students: 27 }));
    else if (api.endsWith("/token-audit/options")) data = { operations: ["AI_GENERATION"], months: ["2026-11-01"] };
    else if (api.endsWith("/token-audit/page")) data = { items: [{ userEmail: "teacher@test.invalid", tokens: 123, operation: "AI_GENERATION", usageMonth: "2026-11-01", recordedAt: "2026-11-01T10:00:00Z" }], totalElements: 1, totalPages: 1, page: 0, size: 10 };
    else if (api === "/api/auth/plans" || api === "/api/admin/plans") data = [{ code: "STARTER", name: "Fixture plan", description: "Fixture licence", annualPriceVnd: 100, studentQuota: 100, monthlyTokenQuota: 1000, active: true }];
    else if (api === "/api/school/billing") data = { planCode: "STARTER", nextPlanCode: null, licenseStart: "2026-01-01", licenseEnd: "2030-01-01", studentsUsed: 12, studentQuota: 100, tokensUsed: 0, monthlyTokenQuota: 1000, payments: [], planChoices: [{ planCode: "STARTER", allowed: true, purpose: "RENEWAL", reason: null }] };
    else if (api.startsWith("/api/school/billing/quote")) data = { planCode: "STARTER", purpose: "RENEWAL", amountVnd: 100, licenseStart: "2030-01-02", licenseEnd: "2031-01-01" };
    else if (api === "/api/curriculum" || api === "/api/admin/curriculum") data = { topics: [] };
    else if (api.startsWith("/api/schools/") && api.endsWith("/classes")) data = classrooms;
    else if (api.endsWith("/profile") && api.includes("/users/")) {
      const id = Number(api.split("/users/")[1].split("/")[0]);
      const account = id === 200 ? { id: 200, fullName: "Fixture teacher", email: "teacher@test.invalid", role: "STAFF", permissions: ["TEACH"] } : people.find(item => item.id === id);
      data = { ...account, avatarUrl: null, dateOfBirth: "1990-01-15", active: true, accountStatus: "ACTIVE", lastLogin: null, schoolId, schoolName: "Fixture school", classes: [{ ...classrooms[0] }] };
    }
    else if (handover && api.endsWith("/teacher") && method === "PUT") { assignedTeacher = nextTeacher; data = {}; }
    else if (handover && api.endsWith("/grade-history")) data = { items: [...history].reverse(), totalElements: history.length, totalPages: 1, page: 0, size: 10 };
    else if (handover && (api.endsWith("/grade") || api.endsWith("/reopen"))) {
      const body = route.request().postDataJSON(), reopen = api.endsWith("/reopen");
      history.push({ id: String(history.length + 1), createdAt: new Date().toISOString(), actorName: "Next teacher", eventType: reopen ? "REOPENED" : "GRADED", previousScore: submission.score, newScore: reopen ? null : body.score, previousFeedback: submission.feedback, newFeedback: reopen ? submission.feedback : body.feedback, previousStatus: submission.gradingStatus, previousGraderName: submission.gradedByName, reason: body.reason });
      submission = { ...submission, score: reopen ? null : body.score, feedback: reopen ? submission.feedback : body.feedback, completedAt: reopen ? null : submission.completedAt, gradingStatus: reopen ? "RETURNED" : "TEACHER_CONFIRMED", gradedByName: "Next teacher" }; data = submission;
    }
    else if (handover && api === "/api/assignments/assignment-1/submissions") data = [submission, { ...submission, id: "submission-2", studentId: 2, studentName: "Student 02", score: null, gradingStatus: "PENDING", predictions: { conclusion: "Short conclusion" } }, { ...submission, id: "submission-3", studentId: 3, studentName: "Student 03", score: null, completedAt: null, gradingStatus: "PENDING", predictions: { answerText: "Prediction in progress" } }];
    else if (api.endsWith("/users")) data = handover ? [...people, nextTeacher] : people;
    else if (api.endsWith("/grades")) data = handover ? gradebookFixture() : { classId: classrooms[0].id, className: "Class 01", schoolYear: "2026-2027", students: [], assignments: [] };
    else if (api.includes("/classes/20000000")) data = { ...classrooms.find(item => api.includes(item.id)), teachers: [assignedTeacher], students: people };
    else if (api === "/api/assignments/mine/teacher") data = [{ id: "assignment-1", title: "Fixture assignment", description: "Fixture", teacherId: 100, studentIds: handover ? [1, 2, 3, 4] : [1], dueAt: "2030-01-01T10:00:00Z", status: "ACTIVE", maxScore: 10, questions: {}, createdAt: "2026-11-01T10:00:00Z" }];
    else if (api === "/api/admin/analytics") data = { postsThisWeek: 0, postsThisMonth: 0, operationsThisWeek: 0, operationsThisMonth: 0, revenue: { totalVnd: 0, weeklyVnd: 0, monthlyVnd: 0, paidCount: 0, pendingCount: 0, failedCount: 0, byPlan: [], timeline: [], recentTransactions: [] } };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  await page.goto(url + openPath);
  return { context, page, requests, errors, writes, receiveAppeal: subject => { appealSent = true; if (subject) appeal = { ...appeal, reason: subject }; }, releaseRoster, updateReport: () => { reportRevision++; }, failNext: path => { failPath = path; }, holdNext: path => { holdPath = path; let release; heldResponse = new Promise(resolve => { release = resolve; }); return release; } };
}
function gradebookFixture() {
  const states = ["TEACHER_CONFIRMED", "NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "RETURNED", "AI_GRADED"];
  const assignments = states.map((_, index) => ({ id: index ? "assignment-" + (index + 1) : "assignment-1", title: index ? "Sample test " + (index + 1) : "Fixture assignment", status: "ACTIVE", maxScore: 10, assignedBy: "Fixture teacher" }));
  return { classId: classrooms[0].id, className: "Class 01", schoolYear: "2026-2027", assignments,
    students: [1, 0].map(index => ({ ...people[index], current: index === 0, cells: states.map((state, column) => ({
      assignmentId: assignments[column].id, submissionId: column ? null : index ? "former-submission" : "submission-1",
      state, score: ["TEACHER_CONFIRMED", "AI_GRADED"].includes(state) ? index ? 7 : 8 : null, maxScore: 10, feedback: "Original feedback", gradedBy: "Fixture teacher",
    })) })) };
}
function pageGradebook(source, parsed) {
  const p = parsed.searchParams, id = p.get("assignment") || "ALL", title = (p.get("title") || "").toLowerCase();
  const from = p.get("from"), to = p.get("to"), membership = p.get("membership") || "CURRENT", query = (p.get("studentQuery") || "").toLowerCase();
  const lessons = source.assignments.filter(item => (id === "ALL" || item.id === id) && item.title.toLowerCase().includes(title) && (!from || (item.assignedAt || "2026-11-01").slice(0, 10) >= from) && (!to || (item.assignedAt || "2026-11-01").slice(0, 10) <= to));
  const allStudents = source.students.filter(student => lessons.length && (membership === "ALL" || student.current === (membership === "CURRENT")) && (student.fullName + " " + student.email).toLowerCase().includes(query) && (id === "ALL" || student.cells.some(cell => cell.assignmentId === id && cell.state !== "NOT_ASSIGNED")));
  const assignmentSize = Math.max(1, Math.min(5, Number(p.get("assignmentSize") || 5))), studentSize = Math.max(1, Math.min(50, Number(p.get("studentSize") || 5)));
  const assignmentPages = Math.max(1, Math.ceil(lessons.length / assignmentSize)), studentPages = Math.max(1, Math.ceil(allStudents.length / studentSize));
  const assignmentPage = Math.min(assignmentPages - 1, Number(p.get("assignmentPage") || 0)), studentPage = Math.min(studentPages - 1, Number(p.get("studentPage") || 0));
  const shown = lessons.slice(assignmentPage * assignmentSize, (assignmentPage + 1) * assignmentSize);
  return { ...source, assignments: shown, students: allStudents.slice(studentPage * studentSize, (studentPage + 1) * studentSize).map(student => ({ ...student, cells: student.cells.filter(cell => shown.some(lesson => lesson.id === cell.assignmentId)) })), totalAssignments: lessons.length, assignmentPage, assignmentSize, assignmentPages, totalStudents: allStudents.length, studentPage, studentSize, studentPages };
}
async function navigate(page, pathname) {
  await page.evaluate(next => { history.pushState({}, "", next); window.dispatchEvent(new PopStateEvent("popstate")); }, pathname);
}
const countRequests = (fixture, api) => fixture.requests.filter(request => request === "/api" + api).length;
try {
  const validation = await fixture("MANAGER", "/manager/validation");
  await expect(validation.page.locator("tbody tr")).toHaveCount(10);
  await validation.page.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(validation.page.getByText("Trang 2/4", { exact: true })).toBeVisible();
  await validation.page.getByRole("combobox", { name: "Lọc chủ đề kiểm định" }).click();
  await validation.page.getByRole("option", { name: "Động học", exact: true }).click();
  await expect(validation.page.getByText("Trang 1/2", { exact: true })).toBeVisible();
  await validation.page.getByRole("combobox", { name: "Lọc trạng thái kiểm định" }).click();
  await validation.page.getByRole("option", { name: "Không đạt", exact: true }).click();
  await expect(validation.page.locator("tbody tr")).toHaveCount(7);
  await validation.page.getByLabel("Kiểm định từ ngày", { exact: true }).fill("2026-11-10");
  await validation.page.getByLabel("Kiểm định đến ngày", { exact: true }).fill("2026-11-30");
  await expect(validation.page.locator("tbody tr")).toHaveCount(3);
  await expect(validation.page.getByText("3 lần chạy phù hợp bộ lọc", { exact: true })).toBeVisible();
  await validation.page.screenshot({ path: path.join(outDir, "manager-validation-filters.png"), fullPage: true, animations: "disabled" });
  await validation.page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(validation.page.locator("tbody tr")).toHaveCount(10);
  await expect(validation.page.getByText("37 lần chạy", { exact: true })).toBeVisible();
  assert.equal(validation.errors.length, 0, validation.errors.join("\n"));
  results.push("Manager validation: server filters combine topic status and dates, reset pagination and clear correctly PASS");
  await validation.context.close();

  if (process.argv.includes("--class-report-only")) {
    const check=await fixture("STAFF","/",false,false,false,false,true);
    let failNextReport=false;const exports=[];
    const fixtureRows=Array.from({length:23},(_,index)=>({id:"lesson-"+index,title:"Fixture bài tập "+index+" "+(index===0?"Tiêu đề dài cần thu gọn ".repeat(12):""),assignedBy:"Giáo viên A",status:index%2?"CLOSED":"ACTIVE",assignedAt:new Date(Date.UTC(2026,10,index+1,8)).toISOString(),dueAt:"2026-11-30T10:00:00Z",recipients:1,submitted:index%3?0:1,notSubmitted:index%3?1:0,late:0,awaitingGrade:index%3?0:1,confirmed:0,missedDeadline:0,average10:null}));
    await check.context.route("**/api/assignments/mine/teacher/classes/*/report**",route=>{
      const url=new URL(route.request().url());check.requests.push(url.pathname+url.search);if(failNextReport){failNextReport=false;return route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({message:"Không đọc được báo cáo thử nghiệm"})});}
      const rows=fixtureRows.filter(row=>(url.searchParams.get("status")==="ALL"||row.status===url.searchParams.get("status"))&&row.title.toLowerCase().includes((url.searchParams.get("query")||"").toLowerCase())&&(!url.searchParams.get("from")||row.assignedAt.slice(0,10)>=url.searchParams.get("from"))&&(!url.searchParams.get("to")||row.assignedAt.slice(0,10)<=url.searchParams.get("to")));
      if(url.pathname.endsWith("/csv")){exports.push(url.searchParams);return route.fulfill({status:200,contentType:"text/csv; charset=UTF-8",headers:{"content-disposition":"attachment; filename=class-report.csv"},body:"\uFEFFLớp,Bài tập,Được giao\r\n"+rows.map(row=>"10A1,"+row.id+",1").join("\r\n")});}
      const size=Number(url.searchParams.get("size")),pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(Number(url.searchParams.get("page")),pages-1),sum=key=>rows.reduce((n,row)=>n+row[key],0);
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({classId:url.pathname.split("/").at(-2),className:"Class report fixture",schoolYear:"2026-2027",asOf:"2026-11-20T10:00:00Z",summary:{assignments:rows.length,recipients:sum("recipients"),submitted:sum("submitted"),notSubmitted:sum("notSubmitted"),late:0,awaitingGrade:sum("awaitingGrade"),confirmed:0,missedDeadline:0,average10:null,submissionRate:rows.length?sum("submitted")*100/rows.length:null},items:rows.slice(page*size,(page+1)*size),page,size,totalPages:pages,totalElements:rows.length})});
    });
    await navigate(check.page,"/lab/reports");await expect(check.page.getByRole("heading",{name:"Kết quả bài tập theo lớp",exact:true})).toBeVisible();
    const region=check.page.getByRole("region",{name:"Danh sách kết quả bài tập",exact:true}),stats=check.page.getByRole("region",{name:"Tổng hợp kết quả",exact:true});
    await expect(region.locator("tbody tr")).toHaveCount(10);await expect(stats).toContainText("23");
    assert.equal(check.requests.filter(url=>url.endsWith("/submissions")).length,0);
    await check.page.screenshot({path:path.join(outDir,"class-report-desktop.png"),fullPage:true,animations:"disabled"});
    const title=region.locator('tbody tr').first().locator('td').first().locator('span[tabindex="0"]');assert.ok(await title.evaluate(el=>el.scrollWidth>el.clientWidth));await title.hover();await expect(check.page.getByRole("tooltip")).toContainText("Tiêu đề dài cần thu gọn");await check.page.keyboard.press("Escape");
    await region.getByRole("button",{name:"Sau",exact:true}).click();await expect(region).toContainText("Trang 2/3");await expect(stats).toContainText("23");
    await check.page.getByRole("combobox",{name:"Số bài mỗi trang",exact:true}).click();await check.page.getByRole("option",{name:"5",exact:true}).click();await expect(region.locator("tbody tr")).toHaveCount(5);await expect(region).toContainText("Trang 1/5");
    await check.page.getByLabel("Tìm bài tập",{exact:true}).fill("Fixture");await check.page.getByLabel("Từ ngày giao",{exact:true}).fill("2026-11-04");await check.page.getByLabel("Đến ngày giao",{exact:true}).fill("2026-11-10");await check.page.getByRole("combobox",{name:"Trạng thái bài tập",exact:true}).click();await check.page.getByRole("option",{name:"Đang mở",exact:true}).click();await check.page.getByRole("button",{name:"Áp dụng",exact:true}).click();await expect(region).toContainText("/ 3 bài tập");await expect(region.locator("tbody tr")).toHaveCount(3);
    const download=check.page.waitForEvent("download");await region.getByRole("button",{name:"Xuất CSV",exact:true}).click();await download;assert.equal(exports.length,1);assert.equal(exports[0].get("from"),"2026-11-04");assert.equal(exports[0].has("page"),false);await expect(check.page.getByRole("status")).toContainText("Đã xuất CSV");
    await check.page.getByLabel("Từ ngày giao",{exact:true}).fill("2026-12-01");await check.page.getByRole("button",{name:"Áp dụng",exact:true}).click();await expect(check.page.getByRole("alert")).toContainText("Từ ngày phải");await check.page.getByRole("button",{name:"Xóa bộ lọc",exact:true}).click();await expect(region.locator("tbody tr")).toHaveCount(5);
    failNextReport=true;await region.getByRole("button",{name:"Làm mới",exact:true}).click();await expect(check.page.getByRole("alert")).toContainText("Không đọc được báo cáo thử nghiệm");await check.page.getByRole("button",{name:"Thử lại",exact:true}).click();await expect(region.locator("tbody tr")).toHaveCount(5);
    await check.page.getByLabel("Tìm bài tập",{exact:true}).fill("không tồn tại");await check.page.getByRole("button",{name:"Áp dụng",exact:true}).click();await expect(region).toContainText("Không có bài tập phù hợp");await expect(region.getByRole("button",{name:"Xuất CSV",exact:true})).toBeDisabled();await check.page.getByRole("button",{name:"Xóa bộ lọc",exact:true}).click();await expect(region.locator("tbody tr")).toHaveCount(5);
    await check.page.emulateMedia({colorScheme:"dark"});await check.page.screenshot({path:path.join(outDir,"class-report-dark.png"),fullPage:true,animations:"disabled"});await check.page.emulateMedia({colorScheme:"light"});await check.page.setViewportSize({width:390,height:844});assert.ok(await check.page.locator("main").evaluate(el=>el.scrollWidth<=el.clientWidth+1));await check.page.screenshot({path:path.join(outDir,"class-report-mobile.png"),fullPage:true,animations:"disabled"});
    await navigate(check.page,"/lab/reports?classId=not-assigned");await expect(check.page.getByRole("alert")).toContainText("không thuộc danh sách");assert.equal(check.requests.filter(url=>url.includes("not-assigned/report")).length,0);
    assert.equal(check.errors.length,0,check.errors.join("\n"));await check.context.close();results.push("Class assignment report: recipient totals, date/status/search filters, pagination, full-filter CSV, truncation tooltip, empty/error/retry, unassigned class guard, dark/mobile PASS");
  }

  if (process.argv.includes("--teacher-dashboard-only")) {
    const check=await fixture("STAFF","/",false,false,false,false,true);
    await expect(check.page).toHaveURL(/\/teacher$/);
    await expect(check.page.getByRole("heading",{name:/Xin chào/})).toBeVisible();
    await expect(check.page.getByRole("link",{name:"Tổng quan",exact:true}).first()).toHaveAttribute("aria-current","page");
    await expect(check.page.getByRole("region",{name:"Thống kê giảng dạy"})).toContainText("Lớp phụ trách");
    await expect(check.page.getByRole("heading",{name:"Lớp đang phụ trách",exact:true})).toBeVisible();
    await expect(check.page.getByRole("heading",{name:"Bài giao gần đây",exact:true})).toBeVisible();
    await expect(check.page.getByRole("link",{name:"Tạo mô phỏng",exact:true})).toHaveAttribute("href","/workspace");
    await expect(check.page.getByRole("link",{name:/Giao bài mới/}).first()).toHaveAttribute("href","/assignments/workspace");
    assert.equal(check.requests.filter(url=>/\/submissions$/.test(url)).length,0,"Dashboard must not fetch every assignment's submissions");
    await check.page.screenshot({path:path.join(outDir,"teacher-dashboard-desktop.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"dark"});await check.page.screenshot({path:path.join(outDir,"teacher-dashboard-dark.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"light"});await check.page.setViewportSize({width:390,height:844});
    assert.ok(await check.page.locator("main").evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await check.page.screenshot({path:path.join(outDir,"teacher-dashboard-mobile.png"),fullPage:true,animations:"disabled"});
    await navigate(check.page,"/workspace");await expect(check.page.getByRole("heading",{name:"Tạo mô phỏng vật lý",exact:true})).toBeVisible();
    await navigate(check.page,"/teacher");await expect(check.page.getByRole("heading",{name:/Xin chào/})).toBeVisible();
    assert.equal(check.requests.filter(url=>url==="/api/assignments/mine/teacher").length,1,"Dashboard revisits reuse cache");
    assert.equal(check.errors.length,0,check.errors.join("\n"));await check.context.close();
    results.push("Teacher dashboard: default staff landing, navigation, scoped metrics, cached revisits, no per-assignment requests, dark/mobile layout PASS");
  }

  if (process.argv.includes("--teacher-workspace-m3-only")) {
    const check=await fixture("STAFF","/");
    let folders=[{id:"m3-folder",name:"Chuyển động",createdAt:"2026-11-01T10:00:00Z"}];
    const items=Array.from({length:10},(_,i)=>({id:"m3-item-"+i,folderId:"m3-folder",simulationId:"saved-"+i,title:i===0?"Bài đặc biệt chuyển động tròn":"Mô phỏng "+i+" "+"Chuyển động và các thông số vật lý ".repeat(8),topic:"KINEMATICS",visibility:"PERSONAL",createdAt:"2026-11-"+String(i+1).padStart(2,"0")+"T10:00:00Z"}));
    await check.context.route("**/api/library/folders",route=>{check.requests.push("/api/library/folders");if(route.request().method()==="POST"){const body=route.request().postDataJSON();folders=[...folders,{id:"new-folder",name:body.name,createdAt:new Date().toISOString()}];check.writes.push({api:"/api/library/folders",body});return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(folders.at(-1))});}return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(folders)});});
    await check.context.route("**/api/library/mine",route=>{check.requests.push("/api/library/mine");return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(items)});});
    const explanation={sessionId:"m3-session",stage:"EXPLAIN",description:"Mô tả đã xác nhận",schemaId:"kinematics",schemaVersion:"1.0",explanation:"Kiểm tra các đại lượng trước khi dựng mô phỏng.",formulas:[],validation:{status:"UNDERSTOOD",flags:[]}};
    let failNextUnderstanding=false;
    await check.context.route("**/api/simulation/understand",route=>{const multipart=route.request().headers()["content-type"]?.includes("multipart/");const body=multipart?{}:route.request().postDataJSON();check.writes.push({api:"/api/simulation/understand",body,multipart});if(failNextUnderstanding){failNextUnderstanding=false;return route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({message:"Không đọc được tình huống thử nghiệm"})});}return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(multipart?{sessionId:"m3-image",stage:"RECOGNITION",recognizedText:"Vật rơi từ độ cao 20 m",displayText:"Vật rơi từ độ cao 20 m",sourceMode:"IMAGE",confidence:.99}:body.recognizedText?explanation:{...explanation,stage:"CLARIFY",question:"Vận tốc ban đầu là bao nhiêu?",choices:[]})});});
    await check.context.route("**/api/simulation/revise",route=>{check.writes.push({api:"/api/simulation/revise",body:route.request().postDataJSON()});return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(explanation)});});
    await navigate(check.page,"/workspace");
    const app=check.page.locator(".teacher-workspace-m3"), input=check.page.getByRole("textbox",{name:"Mô tả tình huống",exact:true}), entry=check.page.getByRole("region",{name:"Tạo mô phỏng vật lý",exact:true});
    await expect(entry).toBeVisible();await expect(entry.getByRole("button",{name:"Tiếp tục",exact:true})).toBeDisabled();await expect(app.locator(".learn-library-item")).toHaveCount(10);
    await check.page.getByRole("button",{name:"Thư mục mới",exact:true}).click();await check.page.locator("#new-library-folder").fill("Thư mục kiểm thử");await check.page.getByRole("button",{name:"Tạo thư mục",exact:true}).click();await expect(app).toContainText("Thư mục kiểm thử");
    const search=check.page.getByRole("searchbox",{name:"Tìm trong thư viện",exact:true});await search.fill("đặc biệt");await expect(app.locator(".learn-library-item")).toHaveCount(1);await search.fill("");
    await check.page.getByRole("button",{name:"Thu gọn thư viện",exact:true}).click();await expect(app.locator(".learn-layout")).toHaveAttribute("data-library-collapsed","true");await check.page.getByRole("button",{name:"Mở thư viện",exact:true}).click();
    await check.page.getByRole("button",{name:/^Ô tô hãm phanh/}).click();await expect(input).toHaveValue(/Một ô tô đang chạy/);await expect(input).toBeFocused();
    const action=entry.getByRole("button",{name:"Tiếp tục",exact:true}),before=await action.boundingBox();await action.hover();const after=await action.boundingBox();assert.ok(Math.abs(before.y-after.y)<1&&before.height>=40);
    await check.page.screenshot({path:path.join(outDir,"teacher-workspace-m3-desktop.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"dark"});await expect(app).toHaveCSS("color","rgb(227, 229, 236)");await check.page.screenshot({path:path.join(outDir,"teacher-workspace-m3-dark.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"light"});await check.page.setViewportSize({width:1800,height:1050});await check.page.screenshot({path:path.join(outDir,"teacher-workspace-m3-wide.png"),fullPage:true,animations:"disabled"});
    await check.page.getByRole("tab",{name:"Giải thích",exact:true}).click();await expect(app).toContainText("Phần giải thích hiện tượng");await check.page.getByRole("tab",{name:"Chi tiết",exact:true}).click();await check.page.getByRole("tab",{name:"Thử nghiệm",exact:true}).click();
    await check.page.setViewportSize({width:390,height:844});await expect(entry).toBeVisible();assert.ok(await app.evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Teacher workspace must fit mobile width");
    await check.page.screenshot({path:path.join(outDir,"teacher-workspace-m3-mobile.png"),fullPage:true,animations:"disabled"});
    await check.page.getByRole("button",{name:"Thông số & Chi tiết",exact:true}).click();await check.page.getByRole("button",{name:/^Ném ngang/}).click();await expect(input).toHaveValue(/Ném một vật/);await expect(input).toBeFocused();
    await action.click();await expect(check.page.getByRole("heading",{name:"Cần làm rõ một chút",exact:true})).toBeVisible();await expect(app.locator('.simulation-steps [aria-current="step"]')).toContainText("Xác nhận");
    const clarify=app.locator(".simulation-card").filter({has:check.page.getByRole("heading",{name:"Cần làm rõ một chút",exact:true})});await clarify.locator("textarea").fill("Vận tốc ban đầu 15 m/s");await clarify.locator('button[type="submit"]').click();await expect(check.page.getByRole("heading",{name:"Xem lại mô phỏng sẽ dựng",exact:true})).toBeVisible();await expect(app.locator('.simulation-steps [aria-current="step"]')).toContainText("Dựng mô phỏng");
    await app.getByRole("button",{name:"Làm lại từ đầu",exact:true}).click();
    await app.locator('input[type="file"]').setInputFiles({name:"physics-fixture.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=","base64")});await expect(app.getByRole("img",{name:"Ảnh đề bài đã thêm",exact:true})).toBeVisible();await action.click();
    await expect(check.page.getByRole("heading",{name:"Hệ thống hiểu mô tả của bạn như sau, đúng chưa?",exact:true})).toBeVisible();await expect(app.locator('.simulation-steps [aria-current="step"]')).toContainText("Xác nhận");await app.getByRole("button",{name:"Sửa lại",exact:true}).click();await app.locator("#simulation-correction").fill("Vật rơi từ độ cao 30 m");await app.getByRole("button",{name:"Kiểm tra lại",exact:true}).click();await expect(check.page.getByRole("heading",{name:"Xem lại mô phỏng sẽ dựng",exact:true})).toBeVisible();
    await app.getByRole("button",{name:"Làm lại từ đầu",exact:true}).click();failNextUnderstanding=true;await input.fill("Tình huống thử lỗi");await action.click();await expect(app.getByRole("alert")).toContainText("Không đọc được tình huống thử nghiệm");
    assert.equal(check.requests.filter(api=>api==="/api/library/mine").length,2);assert.equal(check.errors.length,0,check.errors.join("\n"));await check.context.close();
    results.push("Teacher M3 workspace: library search/folders/collapse, example selection, clarification, image recognition/correction, step states, errors, dark mode, mobile panels and no layout overflow PASS");
  }


  if (process.argv.includes("--reviewer-dashboard-only")) {
    async function reviewerDashboard(permissions = ["CONTENT_EDIT", "CONTENT_REVIEW"], delayDrafts = false) {
      const check = await fixture("REVIEWER", "/");
      let failed = false, empty = false, releaseSchemas; const schemasGate = new Promise(resolve => { releaseSchemas = resolve; }); if (!delayDrafts) releaseSchemas();
      await check.context.route("**/api/user/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...actor("REVIEWER"), permissions }) }));
      const sources = [
        ["**/api/reviewer/library**", "/api/reviewer/library?status=PENDING", [{ id:"pending-1",createdAt:"2026-11-18T08:00:00Z" }, { id:"pending-2",createdAt:"2026-11-19T08:00:00Z" }]],
        ["**/api/support/complaints/review", "/api/support/complaints/review", ["OPEN","READ","RESOLVED"].map((status,i)=>({ id:"report-"+i,kind:"COMPLAINT",subject:"Báo lỗi "+i,content:"Kiểm tra mô phỏng",senderName:"Teacher",senderEmail:"teacher@test.invalid",status,createdAt:i===2?"2026-10-01T08:00:00Z":"2026-11-0"+(i+1)+"T08:00:00Z" }))],
        ["**/api/reviewer/schemas", "/api/reviewer/schemas", ["DRAFT","APPROVED","RETIRED"].map((lifecycleStatus,i)=>({id:"schema-"+i,name:"Chủ đề "+i,schemaId:"schema",version:"1."+i,lifecycleStatus,createdAt:"2026-11-10T08:00:00Z"}))],
        ["**/api/reviewer/law-gaps**", "/api/reviewer/law-gaps?status=OPEN", [{id:"gap-1",occurrences:7}]],
      ];
      for (const [pattern,api,data] of sources) await check.context.route(pattern, async route => { check.requests.push(api); if (api==="/api/reviewer/schemas") await schemasGate; return route.fulfill({status:failed&&api==="/api/reviewer/schemas"?503:200,contentType:"application/json",body:JSON.stringify(failed&&api==="/api/reviewer/schemas"?{message:"Fixture schemas unavailable"}:empty?[]:data)}); });
      await check.page.reload(); await navigate(check.page,"/reviewer");
      return {...check, releaseSchemas, failSchemas:()=>{failed=true;}, emptyAll:()=>{failed=false;empty=true;}};
    }
    const check=await reviewerDashboard(undefined,true), dashboard=check.page.getByTestId("reviewer-dashboard");
    const task=id=>dashboard.locator('article[data-task="'+id+'"]'), priority=check.page.getByRole("region",{name:"Ưu tiên xử lý",exact:true});
    await expect(task("complaints").locator(":scope > strong")).toHaveText("2"); await expect(task("drafts").locator(":scope > strong")).toHaveText("—");
    await expect(dashboard.locator("header")).toContainText("Đang kiểm tra"); check.releaseSchemas();
    await expect(dashboard.locator("header")).toContainText("Hiện có 6 việc"); await expect(priority.locator("li")).toHaveCount(4);
    await expect(priority.locator("li").first()).toContainText("Khiếu nại mô phỏng"); await expect(priority.locator("li").nth(1)).toContainText("Bản nháp chờ phê duyệt");
    await expect(task("moderation").locator(":scope > strong")).toHaveText("2"); await expect(task("gaps").locator(":scope > strong")).toHaveText("1");
    const action=dashboard.locator("header").getByRole("button",{name:"Tiếp tục xử lý",exact:true}); const before=await action.boundingBox(); await action.hover(); const after=await action.boundingBox(); assert.ok(Math.abs(before.y-after.y)<1&&before.height>=40); await action.focus(); await expect(action).toBeFocused();
    await check.page.screenshot({path:path.join(outDir,"reviewer-dashboard-desktop.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"dark"}); await expect(dashboard).toHaveCSS("color","rgb(227, 229, 236)");
    await check.page.screenshot({path:path.join(outDir,"reviewer-dashboard-dark.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"light"}); await check.page.setViewportSize({width:1600,height:1000}); await check.page.screenshot({path:path.join(outDir,"reviewer-dashboard-wide.png"),fullPage:true,animations:"disabled"});
    await check.page.setViewportSize({width:390,height:844}); assert.ok(await dashboard.evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Reviewer dashboard must fit mobile width");
    await check.page.screenshot({path:path.join(outDir,"reviewer-dashboard-mobile.png"),fullPage:true,animations:"disabled"});
    await action.click(); await expect(check.page).toHaveURL(/\/reviewer\/complaints$/); await navigate(check.page,"/reviewer");
    await expect(task("complaints").locator(":scope > strong")).toHaveText("2");
    for (const api of ["/api/reviewer/library?status=PENDING","/api/support/complaints/review","/api/reviewer/schemas","/api/reviewer/law-gaps?status=OPEN"]) assert.equal(check.requests.filter(item=>item===api).length,1,"Sidebar, overview and desks must share "+api);
    check.failSchemas(); await dashboard.getByRole("button",{name:"Làm mới",exact:true}).click(); await expect(dashboard.getByRole("alert")).toContainText("Bản nháp chờ phê duyệt");
    await expect(dashboard).not.toContainText("Đã xử lý hết công việc"); await expect(task("complaints").locator(":scope > strong")).toHaveText("2");
    check.emptyAll(); await dashboard.getByRole("button",{name:"Làm mới",exact:true}).click(); await expect(priority.getByRole("heading",{name:"Đã xử lý hết công việc",exact:true})).toBeVisible();
    await expect(dashboard.locator("header")).toContainText("Không còn công việc đang chờ xử lý"); await expect(task("drafts").locator(":scope > strong")).toHaveText("0"); await expect(action).toHaveCount(0); await check.context.close();
    for (const permissions of [["CONTENT_REVIEW"],["CONTENT_EDIT"],[]]) {
      const scoped=await reviewerDashboard(permissions), home=scoped.page.getByTestId("reviewer-dashboard");
      if (!permissions.length) { await expect(scoped.page.getByRole("heading",{name:"Tài khoản chưa được cấp quyền",exact:true})).toBeVisible(); await expect(home).toHaveCount(0); }
      else { await expect(home.locator("article")).toHaveCount(permissions[0]==="CONTENT_REVIEW"?2:3); await expect(home.locator("header")).toContainText("Hiện có 4 việc"); }
      if (!permissions.includes("CONTENT_EDIT")) assert.ok(!scoped.requests.some(api=>api.includes("/reviewer/schemas")||api.includes("/reviewer/law-gaps")),"No editorial requests without edit permission");
      if (!permissions.includes("CONTENT_REVIEW")) assert.ok(!scoped.requests.some(api=>api.includes("/reviewer/library")),"No moderation requests without review permission");
      await scoped.context.close();
    }
    results.push("Reviewer M3 dashboard: per-group loading, open-only counts, oldest-first work, scoped permissions, shared cache, partial failure, empty queues, navigation, dark mode and mobile fit PASS");
  }


  if (process.argv.includes("--admin-dashboard-only")) {
    const check = await fixture("ADMIN", "/");
    const managers = Array.from({ length: 7 }, (_, index) => ({ ...actor("MANAGER"), id: 200 + index, fullName: "Manager " + index + " " + "Tên rất dài ".repeat(10), email: "manager" + index + "@test.invalid", active: index !== 1, accountStatus: index === 1 ? "SUSPENDED_READ_ONLY" : index === 2 ? "WARNED" : "ACTIVE" }));
    const accounts = [actor("ADMIN"), ...managers, ...people.slice(0, 2), { ...actor("STAFF"), id: 300 }, { ...actor("SCHOOL"), id: 301 }, { ...actor("REVIEWER"), id: 302 }];
    let analytics = { postsThisWeek: 3, postsThisMonth: 7, operationsThisWeek: 56, operationsThisMonth: 210, postBreakdown: { totalCumulativePosts: 21, cumulative: { periodTotalPosts: 21, publicPosts: 2, privatePosts: 16, deletedOrHiddenPosts: 3 }, weekly: { periodTotalPosts: 3, publicPosts: 1, privatePosts: 2, deletedOrHiddenPosts: 0 }, monthly: { periodTotalPosts: 7, publicPosts: 1, privatePosts: 5, deletedOrHiddenPosts: 1 } }, revenue: { totalVnd: 490000000, weeklyVnd: 30000000, monthlyVnd: 80000000, paidCount: 10, pendingCount: 1, failedCount: 2, byPlan: [{planCode:"STARTER",name:"Starter",amountVnd:240000000,count:8},{planCode:"PRO",name:"Professional",amountVnd:50000000,count:1},{planCode:"ENTERPRISE",name:"Enterprise",amountVnd:200000000,count:1}], timeline: [10000000,0,20000000,50000000].map((amountVnd,i)=>({period:"Tuần "+(i+1),amountVnd,posts:0,operations:0})), recentTransactions: ["PAID","PAID","FAILED","PENDING"].map((status,i)=>({ id:"tx-"+i,schoolName:"Trường học "+i+" "+"Tên trường rất dài ".repeat(10),planCode:"STARTER",planName:"Starter",amountVnd:30000000,status,createdAt:"2026-11-19T08:00:00Z" })) } };
    let releaseAnalytics; const analyticsGate = new Promise(resolve=>{releaseAnalytics=resolve;});
    let failed = false;
    await check.context.route("**/api/admin/users", route => { check.requests.push("/api/admin/users"); return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(accounts)}); });
    await check.context.route("**/api/admin/analytics", async route => { check.requests.push("/api/admin/analytics"); await analyticsGate; return route.fulfill({status:failed?503:200,contentType:"application/json",body:JSON.stringify(failed?{message:"Fixture statistics unavailable"}:analytics)}); });
    await navigate(check.page,"/admin");
    const dashboard=check.page.getByTestId("admin-dashboard"), metrics=check.page.getByRole("region",{name:"Chỉ số hoạt động và doanh thu",exact:true});
    const managersPanel=check.page.getByRole("region",{name:"Tài khoản vận hành",exact:true}), roles=check.page.getByRole("region",{name:"Tài khoản theo vai trò",exact:true});
    const metric=label=>metrics.locator("article").filter({has:check.page.getByRole("heading",{name:label,exact:true})}).locator(":scope > strong [data-full-value]");
    await expect(managersPanel.locator("li")).toHaveCount(6); await expect(metric("Doanh thu tuần này")).toHaveText("—");
    await expect(metric("Tài khoản hoạt động")).toHaveText("12"); releaseAnalytics();
    await expect(metric("Doanh thu tuần này")).toHaveText("30.000.000 ₫"); await expect(metric("Mô phỏng mới tuần này")).toHaveText("3");
    await expect(roles.locator("li")).toHaveCount(6); await expect(managersPanel).toContainText("Hiển thị 6 / 7"); await expect(managersPanel.getByText("Tạm khóa",{exact:true})).toBeVisible();
    await expect(managersPanel.getByText("Cảnh báo",{exact:true})).toBeVisible();
    await check.page.getByRole("radio",{name:"Tháng này",exact:true}).click();
    await expect(metric("Doanh thu tháng này")).toHaveText("80.000.000 ₫"); await expect(metric("Mô phỏng mới tháng này")).toHaveText("7"); await expect(metric("Thao tác tháng này")).toHaveText("210");
    const revenuePanel=check.page.getByRole("region",{name:"Doanh thu 4 tuần gần nhất",exact:true}), tx=check.page.getByRole("region",{name:"Giao dịch",exact:true});
    await expect(revenuePanel.getByRole("img")).toContainText("Tuần 1"); await expect(revenuePanel.getByRole("progressbar")).toHaveCount(3); await expect(tx.locator("li")).toHaveCount(4);
    await check.page.getByRole("radio",{name:"Tuần này",exact:true}).click();
    const manage=dashboard.getByRole("link",{name:"Quản lý tài khoản",exact:true}); await expect(manage).toHaveAttribute("href","/admin/users");
    const before=await manage.boundingBox(); await manage.hover(); const after=await manage.boundingBox(); assert.ok(Math.abs(before.y-after.y)<1 && before.height>=40); await manage.focus(); await expect(manage).toBeFocused();
    await check.page.screenshot({path:path.join(outDir,"admin-dashboard-desktop.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"dark"}); await expect(dashboard).toHaveCSS("color","rgb(227, 229, 236)");
    await check.page.screenshot({path:path.join(outDir,"admin-dashboard-dark.png"),fullPage:true,animations:"disabled"});
    await check.page.emulateMedia({colorScheme:"light"}); await check.page.setViewportSize({width:1600,height:1000});
    await check.page.screenshot({path:path.join(outDir,"admin-dashboard-wide.png"),fullPage:true,animations:"disabled"});
    await check.page.setViewportSize({width:390,height:844}); await expect(metrics.locator("article").first().locator("strong")).toHaveAttribute("title", "30.000.000 ₫"); assert.ok(await dashboard.evaluate(el=>el.scrollWidth<=el.clientWidth+1),"Admin dashboard must fit mobile width");
    await check.page.screenshot({path:path.join(outDir,"admin-dashboard-mobile.png"),fullPage:true,animations:"disabled"});
    await manage.click(); await expect(check.page).toHaveURL(/\/admin\/users$/); await navigate(check.page,"/admin");
    await expect(metric("Doanh thu tuần này")).toHaveText("30.000.000 ₫");
    assert.equal(check.requests.filter(item=>item==="/api/admin/analytics").length,1); assert.equal(check.requests.filter(item=>item==="/api/admin/users").length,1);
    failed=true; await dashboard.getByRole("button",{name:"Làm mới",exact:true}).click(); await expect(dashboard.getByRole("alert")).toContainText("Chưa cập nhật được thống kê"); await expect(managersPanel.locator("li")).toHaveCount(6);
    failed=false; analytics={...analytics,postsThisWeek:0,postsThisMonth:0,postBreakdown:undefined,operationsThisWeek:0,operationsThisMonth:0,revenue:{totalVnd:0,weeklyVnd:0,monthlyVnd:0,paidCount:0,pendingCount:0,failedCount:0,byPlan:[],timeline:[],recentTransactions:[]}};
    await dashboard.getByRole("button",{name:"Làm mới",exact:true}).click(); await expect(metric("Doanh thu tuần này")).toHaveText("0 ₫"); await expect(revenuePanel).toContainText("Chưa có giao dịch đã thanh toán trong 4 tuần qua"); await expect(tx).toContainText("Chưa có giao dịch nào");
    assert.ok(!check.requests.some(item=>item.startsWith("/api/manager/")),"Admin redesign must not require manager-only APIs");
    await check.context.close(); results.push("Admin M3 dashboard: independent loading, week/month metrics, chart and cumulative scopes, manager status/limits, cache reuse, errors, empty revenue, dark mode and mobile fit PASS");
  }


  if (process.argv.includes("--school-dashboard-only")) {
    const check = await fixture("SCHOOL", "/", true);
    let data = { schoolId, schoolName: "Trường Vật lý Thực nghiệm", students: 91, teachers: 4, managers: 1, activeClasses: 12, enrolledStudents: 90, usedTokens: 207361, tokenQuota: 1000000, studentQuota: 5000, planCode: "ENTERPRISE", licenseStart: "2026-09-22", licenseEnd: "2027-09-21", licenseStatus: "ACTIVE", usageMonth: "2026-11-01" };
    let licenseData = { active: true, canPerformWriteOperations: true, showRenewalBanner: false, inGraceMode: false, daysUntilExpiry: 305, licenseEnd: "2027-09-21" }, failLicense = false;
    await check.context.route("**/api/schools/*/reports/summary", route => { check.requests.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) }); });
    await check.context.route("**/api/user/me/license", route => { check.requests.push("/api/user/me/license"); return route.fulfill({ status: failLicense ? 503 : 200, contentType: "application/json", body: JSON.stringify(failLicense ? { message: "Fixture temporarily unavailable" } : licenseData) }); });
    await navigate(check.page, "/school");
    const stats = check.page.getByRole("region", { name: "Chỉ số trường học", exact: true }), recent = check.page.getByRole("region", { name: "Lớp học gần đây", exact: true });
    const usage = check.page.getByRole("region", { name: "Hạn mức sử dụng", exact: true }), license = check.page.getByRole("region", { name: "Gói sử dụng", exact: true });
    const header = check.page.locator("header").filter({ has: check.page.getByRole("heading", { name: data.schoolName, exact: true }) });
    await expect(stats).toContainText("207.361"); await expect(stats).toContainText("91");
    await expect(recent.getByText("Class 01", { exact: true })).toHaveCount(0);
    await expect(license).toContainText("305 ngày"); await expect(license).toContainText("ENTERPRISE");
    check.releaseRoster(); await expect(recent.locator("tbody tr")).toHaveCount(5);
    assert.equal(check.requests.filter(item => item === "/api/user/me/license").length, 1);
    await expect(usage.getByRole("progressbar")).toHaveCount(2);
    await expect(usage.getByRole("progressbar", { name: "Token AI tháng này: đã dùng 21% hạn mức", exact: true })).toHaveAttribute("value", "21");
    await expect(recent.getByRole("link", { name: "Xem lớp Class 01", exact: true })).toHaveAttribute("href", "/school/classes/" + classrooms[0].id);
    const manage = header.getByRole("link", { name: "Quản lý lớp học", exact: true }); const before = await manage.boundingBox(); await manage.hover(); const after = await manage.boundingBox();
    assert.ok(Math.abs(before.y-after.y) < 1 && before.height >= 40, "Material button target and hover must remain stable");
    await manage.focus(); await expect(manage).toBeFocused();
    await check.page.screenshot({ path: path.join(outDir, "school-dashboard-desktop.png"), fullPage: true, animations: "disabled" });
    await check.page.emulateMedia({ colorScheme: "dark" }); await expect(check.page.locator("html")).toHaveClass(/dark/);
    await expect(check.page.getByTestId("school-dashboard")).toHaveCSS("color", "rgb(227, 229, 236)");
    await check.page.screenshot({ path: path.join(outDir, "school-dashboard-dark.png"), fullPage: true, animations: "disabled" });
    await check.page.emulateMedia({ colorScheme: "light" }); await check.page.setViewportSize({ width: 1600, height: 1000 });
    await check.page.screenshot({ path: path.join(outDir, "school-dashboard-wide.png"), fullPage: true, animations: "disabled" });
    await check.page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await check.page.locator(".admin-content").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Dashboard must fit mobile width");
    assert.ok(await recent.locator("table").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Class table must fit mobile width");
    await check.page.screenshot({ path: path.join(outDir, "school-dashboard-mobile.png"), fullPage: true, animations: "disabled" });
    await check.page.setViewportSize({ width: 1280, height: 900 });
    data = { ...data, usedTokens: 900000, tokenQuota: 1000000 };
    await header.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(usage.getByRole("progressbar", { name: "Token AI tháng này: đã dùng 90% hạn mức", exact: true })).toHaveAttribute("value", "90");
    data = { ...data, usedTokens: 0, students: 0, studentQuota: 0, tokenQuota: 0 };
    await header.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(usage.getByRole("progressbar").first()).toHaveAttribute("value", "0");
    await expect(usage.getByRole("progressbar").last()).toHaveAttribute("value", "0");
    data = { ...data, usedTokens: 207361, students: 91, studentQuota: null, tokenQuota: null };
    await header.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(usage.getByRole("progressbar")).toHaveCount(0); await expect(usage).toContainText("Gói không giới hạn token AI");
    licenseData = { ...licenseData, active: false, canPerformWriteOperations: false, daysUntilExpiry: -3 }; data = { ...data, licenseStatus: "EXPIRED" };
    await header.getByRole("button", { name: "Làm mới", exact: true }).click(); await expect(license.getByText("Đã hết hạn", { exact: true })).toHaveCount(2);
    data = { ...data, licenseStatus: "UNLICENSED", planCode: null, licenseEnd: null }; licenseData = { ...licenseData, licenseEnd: null };
    await header.getByRole("button", { name: "Làm mới", exact: true }).click(); await expect(license.getByText("Chưa mua gói", { exact: true })).toHaveCount(2);
    await check.context.route("**/api/schools/*/classes/page**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], totalElements: 0, totalPages: 0, page: 0, size: 5 }) }));
    await header.getByRole("button", { name: "Làm mới", exact: true }).click(); await expect(recent.getByRole("heading", { name: "Chưa có lớp đang hoạt động", exact: true })).toBeVisible();
    failLicense = true;
    await header.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(license).toContainText("Chưa tải được thời gian còn lại");
    await expect(license).toContainText("Chưa xác minh"); await expect(stats).toContainText("207.361");
    await check.context.route("**/api/schools/*/classes/page**", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable fixture" }) }));
    await header.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(recent.getByRole("alert")).toContainText("Không thể tải danh sách lớp");
    await check.context.close();
    results.push("School M3 dashboard: independent loading, finite/unlimited/zero quotas, expired/unlicensed states, partial failures, links, stable actions, dark mode and mobile fit PASS");
  }


  if (process.argv.includes("--student-dashboard-only")) {
    const learner = await fixture("STUDENT", "/");
    const common = { libraryItemId: "fixture", specificationId: "fixture", questions: { activityType: "PREDICT_OBSERVE_EXPLAIN", prompt: "Predict" }, studentIds: [102], status: "ACTIVE", assignedAt: "2026-11-01T10:00:00Z", maxScore: 10, className: "Class 01" };
    const items = [
      { ...common, id: "strict", title: "Strict deadline work", dueAt: "2020-01-01T10:00:00Z", allowLateSubmission: false },
      { ...common, id: "late", title: "Late permitted work", dueAt: "2020-01-01T10:00:00Z", allowLateSubmission: true },
      { ...common, id: "returned", title: "Returned work", retryAllowed: true },
      ...Array.from({ length: 4 }, (_, i) => ({ ...common, id: "done-" + i, title: "Submitted work " + i, submissionCompleted: true, completedAt: "2026-11-" + (10+i) + "T10:00:00Z", gradingStatus: i < 2 ? "TEACHER_CONFIRMED" : "PENDING", score: i < 2 ? 8 : null, feedback: i < 2 ? "Teacher feedback " + "Useful comment. ".repeat(40) : null })),
    ];
    await learner.context.route("**/api/assignments/mine/student", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) }));
    await learner.context.route("**/api/student/classes", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...classrooms[0], schoolName: "Fixture school", classmateCount: 26, teachers: [{ id: 200, fullName: "Fixture teacher" }] }]) }));
    await navigate(learner.page, "/student");
    const hero = learner.page.locator(".student-hero"), next = learner.page.locator(".student-up-next"), recent = learner.page.locator(".student-results");
    const stat = label => hero.locator("dl > div").filter({ has: learner.page.locator("dt", { hasText: label }) }).locator("dd");
    await expect(stat("Tổng bài tập")).toHaveText("7");
    await expect(stat("Cần làm / làm lại")).toHaveText("2"); await expect(stat("Đã nộp")).toHaveText("4");
    await expect(next.locator("li")).toHaveCount(2); await expect(next.locator("li").first()).toContainText("Returned work");
    await expect(next).not.toContainText("Strict deadline work"); await expect(next.getByRole("button", { name: "Nộp muộn: Late permitted work", exact: true })).toBeVisible();
    await expect(recent.locator("li")).toHaveCount(3); await expect(recent).toContainText("Đã chấm 2"); await expect(recent).toContainText("Chờ chấm / xác nhận 2");
    await expect(recent).toContainText("8 / 10"); await expect(recent).toContainText("Teacher feedback");
    await learner.page.screenshot({ path: path.join(outDir, "student-dashboard-desktop.png"), fullPage: true, animations: "disabled" });
    const action = next.getByRole("button", { name: "Làm lại: Returned work", exact: true });
    const before = await action.boundingBox(); await action.hover(); const after = await action.boundingBox();
    assert.ok(Math.abs(before.y-after.y) < 1 && Math.abs(before.height-after.height) < 1, "Hover must not shift the action");
    assert.ok(before.width >= 88 && before.height >= 40, "Material action must have a usable target");
    await action.focus(); await expect(action).toBeFocused();
    assert.equal(await action.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
    await learner.page.emulateMedia({ colorScheme: "dark" });
    await expect(learner.page.locator("html")).toHaveClass(/dark/);
    await expect(learner.page.locator(".student-dashboard")).toHaveCSS("color", "rgb(227, 229, 236)");
    await learner.page.screenshot({ path: path.join(outDir, "student-dashboard-dark.png"), fullPage: true, animations: "disabled" });
    await learner.page.emulateMedia({ colorScheme: "light" });
    await learner.page.setViewportSize({ width: 1600, height: 1000 });
    await learner.page.screenshot({ path: path.join(outDir, "student-dashboard-wide.png"), fullPage: true, animations: "disabled" });
    await learner.page.setViewportSize({ width: 1280, height: 900 });

    await next.getByRole("button", { name: "Tất cả bài tập (7)", exact: true }).click();
    await expect(learner.page.locator(".student-assignment-table tbody tr")).toHaveCount(2);
    await learner.page.getByRole("radio", { name: /Quá hạn/ }).click();
    await expect(learner.page.getByText("Quá hạn · 0 điểm", { exact: true })).toBeVisible();
    await expect(learner.page.getByRole("button", { name: "Xem kết quả: Strict deadline work", exact: true })).toBeVisible();
    await navigate(learner.page, "/student"); await learner.page.setViewportSize({ width: 390, height: 844 });
    await expect(stat("Tổng bài tập")).toHaveText("7");
    assert.ok(await learner.page.locator(".student-workspace").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Dashboard must fit mobile width");
    await learner.page.screenshot({ path: path.join(outDir, "student-dashboard-mobile.png"), fullPage: true, animations: "disabled" });
    await learner.context.route("**/api/assignments/mine/student", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await learner.page.reload(); await expect(stat("Tổng bài tập")).toHaveText("0"); await expect(next).toContainText("Chưa có bài tập được giao"); await expect(recent).toHaveCount(0);
    assert.equal(learner.errors.length, 0, learner.errors.join("\n")); await learner.context.close();
    results.push("Student dashboard: seven assignments, strict/allowed deadlines, consistent counts, recent grades/feedback, navigation, mobile and empty state PASS");
  }

  if (process.argv.includes("--reviewer-redesign-only")) {
    const reviewer = await fixture("REVIEWER", "/");
    let reports = Array.from({ length: 23 }, (_, index) => ({ id: String(index + 1).padStart(8, "0") + "-fixture", kind: "COMPLAINT", senderId: 100 + index, senderName: "Teacher " + (index + 1), senderEmail: "teacher" + (index + 1) + "@test.invalid", subject: "Báo lỗi mô phỏng " + (index + 1), content: (index === 22 ? "Nội dung đầy đủ. ".repeat(200) + "END FULL REPORT" : "Nội dung ngắn") + "\n— Đề bài —\nĐề bài vật lý\n— Thông số đang dùng —\ny0 = 28; vx = 6; g = 9.8", status: ["OPEN", "READ", "RESOLVED"][index % 3], createdAt: new Date(Date.UTC(2026, 10, index + 1, 8)).toISOString(), adminResponse: index % 3 === 2 ? "Đã kiểm tra kết quả." : null }));
    await reviewer.context.route("**/api/support/complaints/review**", async route => {
      const api = new URL(route.request().url()).pathname;
      if (route.request().method() === "PUT") { const request = route.request().postDataJSON(); const id = api.split("/").at(-1); reports = reports.map(item => item.id === id ? { ...item, status: request.status, adminResponse: request.response || item.adminResponse, responderName: "Reviewer", respondedAt: new Date().toISOString() } : item); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reports.find(item => item.id === id)) }); }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reports) });
    });
    let versions = [{ id: "schema-old", schemaId: "ac_model", version: "1.0", name: "Dòng điện xoay chiều", topic: "AC", lifecycleStatus: "APPROVED", createdAt: "2026-09-29T10:00:00Z", definition: { grade: 12 } }, { id: "schema-new", schemaId: "ac_model", version: "1.1", name: "Dòng điện xoay chiều", topic: "AC", lifecycleStatus: "DRAFT", createdAt: "2026-11-19T10:00:00Z", definition: { grade: 12 } }];
    await reviewer.context.route("**/api/reviewer/schemas", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(versions) }));
    await reviewer.context.route("**/api/reviewer/schema-versions/*/lifecycle?*", route => { const parsed = new URL(route.request().url()), id = parsed.pathname.split("/").at(-2); versions = versions.map(item => ({ ...item, lifecycleStatus: item.id === id ? "APPROVED" : item.schemaId === "ac_model" && item.lifecycleStatus === "APPROVED" ? "RETIRED" : item.lifecycleStatus })); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(versions.find(item => item.id === id)) }); });
    await navigate(reviewer.page, "/reviewer/complaints");
    const table = reviewer.page.getByRole("region", { name: "Danh sách khiếu nại Reviewer", exact: true });
    await expect(table.locator("tbody tr")).toHaveCount(5);
    await expect(table.locator("tbody tr").first()).toContainText("Teacher 23");
    const heights = await table.locator("tbody tr").evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
    assert.ok(Math.max(...heights) - Math.min(...heights) < 2);
    await reviewer.page.screenshot({ path: path.join(outDir, "reviewer-complaints-table.png"), fullPage: true });
    await table.locator("tbody tr").first().getByRole("button", { name: "Xử lý", exact: true }).click();
    const dialog = reviewer.page.getByRole("dialog", { name: "Xử lý khiếu nại mô phỏng", exact: true });
    await expect(dialog).toContainText("END FULL REPORT");
    await dialog.getByRole("button", { name: "Hoàn tất xử lý", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Hãy nhập phản hồi");
    await dialog.locator("summary").click(); await expect(dialog.getByText(/y0 = 28; vx = 6/)).toBeVisible();
    await dialog.getByLabel("Kết quả kiểm tra và hướng xử lý", { exact: true }).fill("Đã kiểm tra đầy đủ. Vui lòng thử lại mô phỏng.");
    await dialog.getByRole("button", { name: "Gửi phản hồi", exact: true }).click();
    await expect(dialog.getByText("Đã kiểm tra đầy đủ. Vui lòng thử lại mô phỏng.", { exact: true })).toBeVisible();
    await reviewer.page.screenshot({ path: path.join(outDir, "reviewer-complaint-dialog.png"), fullPage: true });
    await dialog.getByRole("button", { name: "Hoàn tất xử lý", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(table.locator("tbody")).not.toContainText("Teacher 23");
    await reviewer.page.getByRole("combobox", { name: "Số khiếu nại Reviewer mỗi trang", exact: true }).click(); await reviewer.page.getByRole("option", { name: "10", exact: true }).click();
    await expect(table.locator("tbody tr")).toHaveCount(10);
    await reviewer.page.getByLabel("Reviewer khiếu nại từ ngày", { exact: true }).fill("2026-11-10"); await reviewer.page.getByLabel("Reviewer khiếu nại đến ngày", { exact: true }).fill("2026-11-15");
    await expect(table.locator("tbody tr")).toHaveCount(4);
    await reviewer.page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await reviewer.page.getByRole("radio", { name: /Đã giải quyết/ }).click();
    await table.locator("tbody tr").first().getByRole("button", { name: "Xem chi tiết", exact: true }).click(); await expect(dialog.getByRole("textbox")).toHaveCount(0); await dialog.getByRole("button", { name: "Đóng chi tiết khiếu nại", exact: true }).click();
    await navigate(reviewer.page, "/reviewer/topics");
    await reviewer.page.getByRole("row").filter({ hasText: "v1.1" }).getByRole("button", { name: "Thao tác với Dòng điện xoay chiều", exact: true }).click(); await reviewer.page.getByRole("menuitem", { name: "Phê duyệt", exact: true }).click();
    const publish = reviewer.page.getByRole("dialog", { name: "Phê duyệt phiên bản?", exact: true }); await expect(publish).toContainText("Ngừng dùng"); await publish.getByRole("button", { name: "Phê duyệt", exact: true }).click(); await expect(publish).toHaveCount(0);
    await expect(reviewer.page.getByRole("row").filter({ hasText: "v1.0" })).toContainText("Ngừng sử dụng"); await expect(reviewer.page.getByRole("row").filter({ hasText: "v1.1" })).toContainText(/Đang (sử dụng|dùng)/);
    await reviewer.page.screenshot({ path: path.join(outDir, "reviewer-schema-versions.png"), fullPage: true }); assert.equal(reviewer.errors.length, 0, reviewer.errors.join("\n")); await reviewer.context.close();
    const manager = await fixture("MANAGER", "/manager/curriculum"); await expect(manager.page.getByRole("heading", { name: "Chương trình học", exact: true })).toBeVisible(); await expect(manager.page.getByRole("button", { name: "Thêm nội dung", exact: true })).toHaveCount(0); await expect(manager.page.getByRole("dialog")).toHaveCount(0); assert.equal(manager.errors.length, 0); await manager.context.close();
    results.push("Reviewer complaints: uniform rows, full scrollable detail, response validation and resolution, date filters, pagination, automatic old-version retirement UI; Manager curriculum add removed PASS");
  }
  if (process.argv.includes("--gradebook-pages-only") || process.argv.includes("--gradebook-layout-only")) {
    for (const role of ["SCHOOL", "STAFF"]) {
      const check = await fixture(role, role === "STAFF" ? "/lab/classes" : "/school/classes/" + classrooms[0].id, false, true, false, false, role === "STAFF");
      const base = gradebookFixture();
      base.assignments = Array.from({ length: 1000 }, (_, index) => ({ ...base.assignments[0], id: "test-" + index, title: "Physics assignment " + String(index + 1).padStart(4, "0") + " " + "A detailed scenario. ".repeat(12), assignedAt: new Date(Date.UTC(2026, 10 - Math.floor(index / 20), 15)).toISOString() }));
      base.students = Array.from({ length: 32 }, (_, index) => ({ ...base.students[1], id: index + 1, fullName: "Student " + String(index + 1).padStart(2, "0"), email: "student" + (index + 1) + "@test.invalid", current: index < 30, cells: base.assignments.map(lesson => ({ ...base.students[1].cells[0], assignmentId: lesson.id, state: lesson.id === "test-0" && index !== 0 ? "NOT_ASSIGNED" : "TEACHER_CONFIRMED" })) }));
      await check.context.route("**/api/**/grades/page?*", route => { const parsed = new URL(route.request().url()); check.requests.push(parsed.pathname + parsed.search); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageGradebook(base, parsed)) }); });
      await navigate(check.page, role === "STAFF" ? "/lab/classes/" + classrooms[0].id + "?tab=grades" : "/school/classes/" + classrooms[0].id + "?view=grades");
      const panel = check.page.getByRole("region", { name: "Bảng điểm lớp học", exact: true });
      const table = check.page.getByRole("region", { name: "Bảng điểm lớp học có phân trang", exact: true });
      await expect(table.locator("tbody tr")).toHaveCount(5);
      const columnCount = await table.locator("thead th").count();
      assert.ok(columnCount >= 2 && columnCount <= 6);
      assert.ok(await table.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Gradebook must fit without horizontal clipping");
      const title = table.locator("thead strong").first(); await title.hover();
      await expect(check.page.getByRole("tooltip")).toContainText("Physics assignment 0001"); await check.page.mouse.move(0, 0);
      await panel.getByRole("button", { name: "Bài tiếp", exact: true }).click();
      await expect(table.locator("thead th").nth(1)).not.toContainText("0001");
      await panel.getByRole("button", { name: "Sau", exact: true }).click();
      await expect(panel.getByText("Trang học sinh 2/6", { exact: true })).toBeVisible();
      await panel.getByLabel("Ngày giao từ", { exact: true }).fill("2026-11-01"); await panel.getByLabel("Ngày giao đến", { exact: true }).fill("2026-11-30");
      await expect(panel.getByText("Trang học sinh 1/6", { exact: true })).toBeVisible();
      await expect.poll(() => check.requests.filter(item => item.includes("/grades/page?")).at(-1)).toContain("from=2026-11-01");
      await panel.getByRole("textbox", { name: "Tìm bài tập trong bảng điểm", exact: true }).fill("0001");
      await expect(table.locator("thead th")).toHaveCount(2);
      await panel.getByRole("combobox", { name: "Lọc bài tập", exact: true }).click();
      await check.page.getByRole("option", { name: base.assignments[0].title, exact: true }).click();
      await expect(table.locator("tbody tr")).toHaveCount(1);
      await expect(table.locator("tbody")).toContainText("Student 01");
      await panel.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
      await expect(table.locator("tbody tr")).toHaveCount(5);
      await expect(panel.getByRole("group", { name: "Phân trang bài tập", exact: true })).toContainText("1000");
      await panel.getByRole("combobox", { name: "Số học sinh mỗi trang trong bảng điểm", exact: true }).click(); await check.page.getByRole("option", { name: "10", exact: true }).click();
      await expect(table.locator("tbody tr")).toHaveCount(10);
      await check.page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("main, .teacher-area__content").forEach(el => { el.scrollTop = 0; }); });
      await check.page.screenshot({ path: path.join(outDir, role.toLowerCase() + "-gradebook-pages.png"), fullPage: true, animations: "disabled" });
      await check.page.setViewportSize({ width: 390, height: 844 });
      await expect(table.locator("thead th")).toHaveCount(2);
      assert.ok(await table.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Mobile table must fit fully");
      assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Mobile filters must fit fully");
      await check.page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("main, .teacher-area__content").forEach(el => { el.scrollTop = 0; }); });
      await check.page.screenshot({ path: path.join(outDir, role.toLowerCase() + "-gradebook-mobile.png"), fullPage: true, animations: "disabled" });
      await panel.getByLabel("Ngày giao từ", { exact: true }).fill("2026-11-30"); await panel.getByLabel("Ngày giao đến", { exact: true }).fill("2026-11-01");
      await expect(panel.getByRole("alert")).toContainText("Từ ngày phải trước");
      assert.equal(check.errors.length, 0, check.errors.join("\n")); await check.context.close();
    }
    results.push("School and Teacher: 1000 assignment fixture, bounded columns, independent student/assignment pagination, sent-date/title filters, individual recipient, mobile fit PASS");
  }
  if (process.argv.includes("--deadline-only")) {
    const learner = await fixture("STUDENT", "/student/assignments");
    const common = { libraryItemId: "fixture", specificationId: "fixture", questions: { activityType: "PREDICT_OBSERVE_EXPLAIN", prompt: "Predict" }, studentIds: [102], status: "ACTIVE", assignedAt: "2026-11-01T10:00:00Z", dueAt: "2020-01-01T10:00:00Z", maxScore: 10 };
    await learner.context.route("**/api/assignments/mine/student", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
      { ...common, id: "strict", title: "Strict deadline work", allowLateSubmission: false, gradingStatus: "MISSED_DEADLINE", score: 0 },
      { ...common, id: "late", title: "Late permitted work", allowLateSubmission: true },
    ]) }));
    await learner.page.reload();
    await expect(learner.page.getByRole("button", { name: "Nộp muộn: Late permitted work", exact: true })).toBeVisible();
    await learner.page.getByRole("radio", { name: /Quá hạn/ }).click();
    await expect(learner.page.getByText("Quá hạn · 0 điểm", { exact: true })).toBeVisible();
    await learner.page.getByRole("button", { name: "Xem kết quả: Strict deadline work", exact: true }).click();
    await expect(learner.page.getByText(/Bạn chưa nộp bài hoàn chỉnh nên được ghi nhận 0/)).toBeVisible();
    await expect(learner.page.getByRole("button", { name: "Nộp bài", exact: true })).toHaveCount(0);
    await expect(learner.page.getByRole("button", { name: /Gửi dự đoán/ })).toHaveCount(0);
    await learner.page.screenshot({ path: path.join(outDir, "student-missed-deadline.png"), fullPage: true });
    await learner.context.close();
    const teacher = await fixture("STAFF", "/assignments/workspace?classId=" + classrooms[0].id, false, true, false, false, true);
    await teacher.page.locator("#assignment-library-item").click();
    await teacher.page.getByRole("option", { name: "Fixture simulation", exact: true }).click();
    await teacher.page.locator("#assignment-prompt").fill("Predict then explain");
    await teacher.page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    const late = teacher.page.getByRole("checkbox", { name: "Cho phép nộp trễ", exact: true });
    await expect(late).not.toBeChecked(); await expect(late).toBeDisabled();
    await teacher.page.locator("#assignment-due-at").fill("2030-12-01T10:00");
    await expect(late).toBeEnabled();
    await expect(teacher.page.getByText(/Học sinh chưa nộp bài hoàn chỉnh được ghi nhận 0 điểm/)).toBeVisible();
    await late.check();
    await teacher.page.screenshot({ path: path.join(outDir, "teacher-late-policy.png"), fullPage: true });
    await teacher.page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await teacher.page.getByRole("button", { name: "Giao bài cho cả lớp", exact: true }).click();
    await expect.poll(() => teacher.writes.some(item => item.api === "/api/assignments")).toBe(true);
    assert.equal(teacher.writes.find(item => item.api === "/api/assignments").body.allowLateSubmission, true);
    assert.equal(teacher.errors.length, 0); await teacher.context.close();
    results.push("Deadlines: student cannot submit strict overdue work, zero result visible, late work remains available, teacher setting reaches create API PASS");
  }
  if (process.argv.includes("--complaint-dates-only")) {
    const complaints = await fixture("STAFF", "/lab/complaints", false, false, false, false, false, true);
    const complaintTable = complaints.page.getByRole("region", { name: "Danh sách khiếu nại có thể cuộn", exact: true });
    await expect(complaintTable.locator("tbody tr")).toHaveCount(10);
    await expect(complaintTable.locator("tbody tr").first()).toContainText("Báo lỗi 23");
    const heights = await complaintTable.locator("tbody tr").evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
    assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, "Complaint summaries should use consistent row heights");
    await complaints.page.screenshot({ path: path.join(outDir, "teacher-complaints-table-dates.png"), fullPage: true });
    await complaintTable.locator("tbody tr").first().getByRole("button", { name: "Xem chi tiết", exact: true }).click();
    const complaintDialog = complaints.page.getByRole("dialog", { name: "Chi tiết khiếu nại", exact: true });
    await expect(complaintDialog.getByText(/END FULL COMPLAINT/)).toBeAttached();
    await expect(complaintDialog.getByText(/v = 15 m\/s/)).toBeAttached();
    await expect(complaintDialog.getByText("Phản hồi đầy đủ", { exact: true })).toBeAttached();
    await complaints.page.screenshot({ path: path.join(outDir, "teacher-complaints-full-detail.png"), fullPage: true });
    await complaints.page.keyboard.press("Escape");
    await complaints.page.getByRole("button", { name: "Sau", exact: true }).click();
    await expect(complaintTable.locator("tbody tr").first()).toContainText("Báo lỗi 13");
    await complaints.page.getByLabel("Khiếu nại từ ngày", { exact: true }).fill("2026-11-10");
    await complaints.page.getByLabel("Khiếu nại đến ngày", { exact: true }).fill("2026-11-12");
    await expect(complaintTable.locator("tbody tr")).toHaveCount(3);
    await complaints.page.getByRole("combobox", { name: "Trạng thái khiếu nại", exact: true }).click();
    await complaints.page.getByRole("option", { name: "Chờ xử lý", exact: true }).click();
    await expect(complaintTable.locator("tbody tr")).toHaveCount(1);
    await expect(complaintTable).toContainText("Báo lỗi 10");
    await complaints.page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await expect(complaintTable.locator("tbody tr")).toHaveCount(10);
    await complaints.page.getByRole("combobox", { name: "Số khiếu nại mỗi trang", exact: true }).click();
    await complaints.page.getByRole("option", { name: "25", exact: true }).click();
    await expect(complaintTable.locator("tbody tr")).toHaveCount(23);
    assert.equal(complaints.errors.length, 0, complaints.errors.join("\n"));
    await complaints.context.close();
    const schoolDates = await fixture("SCHOOL", "/school/appeals", false, false, false, false, false, true);
    await expect(schoolDates.page.locator("tbody tr")).toHaveCount(10);
    await schoolDates.page.getByRole("button", { name: "Sau", exact: true }).click();
    await expect(schoolDates.page.getByText("Trang 2/3", { exact: true })).toBeVisible();
    await schoolDates.page.getByLabel("Yêu cầu từ ngày", { exact: true }).fill("2026-11-10");
    await schoolDates.page.getByLabel("Yêu cầu đến ngày", { exact: true }).fill("2026-11-12");
    await expect(schoolDates.page.locator("tbody tr")).toHaveCount(3);
    await expect(schoolDates.page.getByText("Trang 1/1", { exact: true })).toBeVisible();
    await schoolDates.page.getByRole("combobox", { name: "Trạng thái", exact: true }).click();
    await schoolDates.page.getByRole("option", { name: "Đã hoàn tất", exact: true }).click();
    await expect(schoolDates.page.locator("tbody tr")).toHaveCount(2);
    await schoolDates.page.screenshot({ path: path.join(outDir, "school-appeals-date-filters.png"), fullPage: true });
    assert.ok(schoolDates.requests.some(request => request.includes("from=2026-11-10") && request.includes("to=2026-11-12") && request.includes("status=DONE")));
    await schoolDates.page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await expect(schoolDates.page.locator("tbody tr")).toHaveCount(10);
    await schoolDates.page.getByRole("combobox", { name: "Số yêu cầu mỗi trang", exact: true }).click();
    await schoolDates.page.getByRole("option", { name: "25", exact: true }).click();
    await expect(schoolDates.page.locator("tbody tr")).toHaveCount(23);
    assert.equal(schoolDates.errors.length, 0, schoolDates.errors.join("\n"));
    await schoolDates.context.close();
    results.push("Teacher and school complaints: uniform table, complete detail, combined sent-date/status filters, reset and pagination PASS");
  }
  if (process.argv.includes("--teacher-classes-only")) {
    const teaching = await fixture("STAFF", "/lab/classes", false, true, false, false, true);
    await expect(teaching.page.getByRole("heading", { name: "Lớp phụ trách", exact: true })).toBeVisible();
    const directory = teaching.page.getByRole("region", { name: "Danh sách lớp phụ trách" });
    await expect(directory.getByRole("link", { name: /Xem lớp/ })).toHaveCount(2);
    await teaching.page.screenshot({ path: path.join(outDir, "teacher-class-list.png"), fullPage: true });
    await directory.getByRole("link", { name: "Xem lớp Class 01", exact: true }).click();
    await expect(teaching.page.getByText("student1@test.invalid", { exact: true })).toBeVisible();
    await expect(teaching.page.locator("tbody tr")).toHaveCount(3);
    await teaching.page.screenshot({ path: path.join(outDir, "teacher-class-students.png"), fullPage: true });
    await teaching.page.getByRole("tab", { name: "Bài đã giao & chấm điểm", exact: true }).click();
    await expect(teaching.page.getByRole("combobox", { name: "Chọn bài tập của lớp", exact: true })).toHaveText("Fixture assignment");
    await expect(teaching.page.getByText("Other class assignment", { exact: true })).toHaveCount(0);
    await teaching.page.screenshot({ path: path.join(outDir, "teacher-assignment-redesign.png"), fullPage: true });
    await teaching.page.getByRole("group", { name: "Lọc bài nộp của lớp", exact: true }).getByRole("button", { name: "Chưa nộp", exact: false }).click();
    await expect(teaching.page.locator("tbody tr")).toHaveCount(2);
    await teaching.page.getByRole("group", { name: "Lọc bài nộp của lớp", exact: true }).getByRole("button", { name: "Đã nộp", exact: false }).click();
    await expect(teaching.page.locator("tbody tr")).toHaveCount(2);
    await teaching.page.getByRole("group", { name: "Lọc bài nộp của lớp", exact: true }).getByRole("button", { name: "Tất cả", exact: false }).click();
    await teaching.page.getByRole("searchbox", { name: "Tìm học sinh để chấm", exact: true }).fill("Student 01");
    await expect(teaching.page.locator("tbody tr")).toHaveCount(1);
    const csvDownload = teaching.page.waitForEvent("download");
    await teaching.page.getByRole("button", { name: "Xuất điểm CSV", exact: true }).click();
    const downloaded = await csvDownload;
    assert.equal(downloaded.suggestedFilename(), "diem-Fixture-assignment.csv");
    const csvText = await readFile(await downloaded.path(), "utf8");
    assert.ok(csvText.includes("Student 03")); assert.ok(csvText.includes("Former student,0"));
    await expect(teaching.page.getByRole("status")).toContainText("Đã xuất điểm CSV");
    teaching.failNext("/api/assignments/assignment-1/grades.csv");
    await teaching.page.getByRole("button", { name: "Xuất điểm CSV", exact: true }).click();
    await expect(teaching.page.getByRole("alert")).toContainText("Không thể xuất điểm CSV");
    await expect(teaching.page.getByRole("button", { name: "Xuất điểm CSV", exact: true })).toBeEnabled();
    await teaching.page.getByRole("searchbox", { name: "Tìm học sinh để chấm", exact: true }).fill("");
    await teaching.page.getByRole("button", { name: "Sửa điểm", exact: true }).click();
    const classGradeDialog = teaching.page.getByRole("dialog", { name: "Bài làm của Student 01", exact: true });
    await classGradeDialog.getByLabel("Điểm", { exact: true }).fill("9");
    await classGradeDialog.getByLabel(/Lý do thay đổi/).fill("Reviewed in the class workspace");
    await teaching.page.screenshot({ path: path.join(outDir, "teacher-class-grading.png"), fullPage: true });
    await classGradeDialog.getByRole("button", { name: "Xác nhận điểm", exact: true }).click();
    await expect(teaching.page.getByText("9/10", { exact: true })).toBeVisible();
    await teaching.page.getByRole("tab", { name: "Bảng điểm", exact: true }).click();
    await teaching.page.getByRole("button", { name: "Student 01 - Fixture assignment: 9/10", exact: true }).click();
    const resultDialog = teaching.page.getByRole("dialog", { name: "Chi tiết kết quả học tập", exact: true });
    await expect(resultDialog.getByRole("region", { name: "Lịch sử chấm và sửa điểm", exact: true })).toContainText("Reviewed in the class workspace");
    await resultDialog.getByRole("button", { name: "Xem bài nộp và chấm", exact: true }).click();
    await expect(teaching.page.locator("tbody tr")).toHaveCount(1);
    await expect(teaching.page.getByText("9/10", { exact: true })).toBeVisible();
    await teaching.page.getByRole("link", { name: "Giao bài cho lớp này", exact: true }).click();
    await expect(teaching.page).toHaveURL(new RegExp("classId=" + classrooms[0].id));
    await teaching.page.locator("#assignment-library-item").click();
    await teaching.page.getByRole("option", { name: "Fixture simulation", exact: true }).click();
    await teaching.page.locator("#assignment-prompt").fill("Predict the outcome then explain it.");
    await teaching.page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await expect(teaching.page.locator("#assignment-class")).toBeVisible();
    await expect(teaching.page.locator("#assignment-class")).toContainText("Class 01");
    await teaching.page.screenshot({ path: path.join(outDir, "teacher-class-assignment.png"), fullPage: true });
    await teaching.page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await teaching.page.getByRole("button", { name: "Giao bài cho cả lớp", exact: true }).click();
    await expect.poll(() => teaching.writes.filter(item => item.api === "/api/assignments").length).toBe(1);
    const creation = teaching.writes.find(item => item.api === "/api/assignments");
    assert.equal(creation.body.classId, classrooms[0].id); assert.deepEqual(creation.body.studentIds, [1, 2, 3]);
    await navigate(teaching.page, "/lab/classes/" + classrooms[1].id + "?tab=assignments");
    await expect(teaching.page.getByRole("combobox", { name: "Chọn bài tập của lớp", exact: true })).toHaveText("Other class assignment");
    await expect(teaching.page.getByText("Fixture assignment", { exact: true })).toHaveCount(0);
    await navigate(teaching.page, "/lab/classes/" + classrooms[0].id);
    await teaching.page.setViewportSize({ width: 390, height: 844 });
    await expect(teaching.page.getByText("student1@test.invalid", { exact: true })).toBeVisible();
    assert.ok(await teaching.page.locator(".teacher-area__content").evaluate(element => element.scrollWidth <= element.clientWidth + 1), "The class workspace must fit mobile without whole-page horizontal scrolling");
    await teaching.page.screenshot({ path: path.join(outDir, "teacher-class-mobile.png"), fullPage: true });
    await navigate(teaching.page, "/lab/classes/not-assigned");
    await expect(teaching.page.getByRole("heading", { name: "Không truy cập được lớp", exact: true })).toBeVisible();
    assert.equal(teaching.errors.length, 0, teaching.errors.join("\n"));
    results.push("Teacher classes: scoped rosters, per-class assignments, grading history, gradebook and preselected class creation PASS");
    await teaching.context.close();
  }
  if (!process.argv.includes("--class-report-only") && !process.argv.includes("--teacher-dashboard-only") && !process.argv.includes("--teacher-workspace-m3-only") && !process.argv.includes("--reviewer-dashboard-only") && !process.argv.includes("--admin-dashboard-only") && !process.argv.includes("--school-dashboard-only") && !process.argv.includes("--student-dashboard-only") && !process.argv.includes("--reviewer-redesign-only") && !process.argv.includes("--gradebook-pages-only") && !process.argv.includes("--deadline-only") && !process.argv.includes("--gradebook-layout-only") && !process.argv.includes("--validation-only") && !process.argv.includes("--teacher-classes-only") && !process.argv.includes("--complaint-dates-only")) {
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
  const reports = await fixture("SCHOOL", "/school/reports");
  const summaryPath = "/schools/" + schoolId + "/reports/summary";
  const tokenPath = "/schools/" + schoolId + "/reports/token-audit/page?page=0&size=10";
  await expect(reports.page.getByRole("heading", { name: "Thống kê lớp học", exact: true })).toBeVisible();
  await expect(reports.page.getByText("teacher@test.invalid", { exact: true })).toBeVisible();
  await navigate(reports.page, "/school/users");
  await expect(reports.page.getByText("Student 01", { exact: true })).toBeVisible();
  await navigate(reports.page, "/school/reports");
  await expect(reports.page.getByRole("heading", { name: "Thống kê lớp học", exact: true })).toBeVisible();
  assert.equal(countRequests(reports, summaryPath), 1);
  assert.equal(countRequests(reports, tokenPath), 1);
  reports.updateReport();
  await reports.page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect.poll(() => countRequests(reports, summaryPath)).toBe(2);
  await expect(reports.page.locator(".admin-stat-card").first()).toContainText("13");
  reports.failNext("/api" + summaryPath);
  await expect(reports.page.getByRole("button", { name: "Làm mới", exact: true })).toBeEnabled();
  await reports.page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(reports.page.getByRole("alert")).toContainText("Fixture refresh failed");
  await expect(reports.page.getByText("Class 01", { exact: true })).toBeVisible();
  await reports.page.clock.install();
  await reports.page.clock.fastForward(31_000);
  reports.updateReport();
  const releaseSummary = reports.holdNext("/api" + summaryPath);
  await navigate(reports.page, "/school/users");
  await expect(reports.page.getByText("Student 01", { exact: true })).toBeVisible();
  const beforeStaleReturn = countRequests(reports, summaryPath);
  await navigate(reports.page, "/school/reports");
  await expect.poll(() => countRequests(reports, summaryPath)).toBeGreaterThan(beforeStaleReturn);
  await expect(reports.page.getByRole("heading", { name: "Thống kê lớp học", exact: true })).toBeVisible();
  await expect(reports.page.locator(".admin-stat-card").first()).toContainText("13");
  releaseSummary();
  await expect(reports.page.locator(".admin-stat-card").first()).toContainText("14");
  assert.equal(reports.errors.length, 0, reports.errors.join("\n"));
  results.push("School reports: route cache, explicit refresh, updated totals and cached data on refresh failure and stale background refresh PASS");
  await navigate(reports.page, "/school/users");
  await expect(reports.page.getByText("Student 01", { exact: true })).toBeVisible();
  await reports.page.getByRole("button", { name: "Thao tác với student1@test.invalid", exact: true }).click();
  await reports.page.getByRole("menuitem", { name: "Xem hồ sơ", exact: true }).click();
  await expect(reports.page.getByRole("dialog").getByRole("heading", { name: "Student 01", exact: true })).toBeVisible();
  await reports.page.getByRole("dialog").getByRole("button", { name: "Đóng", exact: true }).click();
  await reports.page.getByRole("button", { name: "Thao tác với student1@test.invalid", exact: true }).click();
  await reports.page.getByRole("menuitem", { name: "Xem hồ sơ", exact: true }).click();
  await expect(reports.page.getByRole("dialog").getByRole("heading", { name: "Student 01", exact: true })).toBeVisible();
  assert.equal(countRequests(reports, "/schools/" + schoolId + "/users/1/profile"), 1);
  results.push("School accounts: profile menu reuses the same cached read-only dialog PASS");
  await reports.context.close();

  const detailPath = "/school/classes/" + classrooms[0].id;
  const detail = await fixture("SCHOOL", detailPath + "?mode=edit");
  const className = detail.page.getByText("Tên lớp", { exact: true }).locator("..").getByRole("textbox");
  await expect(className).toHaveValue("Class 01");
  await className.fill("Unsaved class draft");
  const detailApi = "/schools/" + schoolId + "/classes/" + classrooms[0].id;
  const beforeDetail = countRequests(detail, detailApi);
  await expect.poll(() => streams.size).toBeGreaterThan(0);
  emit("/api" + detailApi + "/teachers/200");
  await expect.poll(() => countRequests(detail, detailApi)).toBeGreaterThan(beforeDetail);
  await expect(className).toHaveValue("Unsaved class draft");
  await detail.page.getByRole("button", { name: "Xem hồ sơ Fixture teacher", exact: true }).click();
  const teacherProfile = detail.page.getByRole("dialog");
  await expect(teacherProfile.getByRole("heading", { name: "Fixture teacher", exact: true })).toBeVisible();
  await expect(teacherProfile.getByText("Lớp đang được phân công", { exact: true })).toBeVisible();
  await expect(teacherProfile.getByText("Class 01", { exact: true })).toBeVisible();
  assert.equal(await teacherProfile.getByRole("textbox").count(), 0);
  await teacherProfile.screenshot({ path: path.join(outDir, "school-teacher-profile-desktop.png") });
  await detail.page.setViewportSize({ width: 390, height: 480 });
  await expect(teacherProfile.getByRole("heading", { name: "Fixture teacher", exact: true })).toBeVisible();
  assert.ok(await teacherProfile.evaluate(element => element.scrollWidth <= element.clientWidth), "Profile must not overflow horizontally");
  assert.ok(await teacherProfile.evaluate(element => [...element.children].some(child => getComputedStyle(child).overflowY === "auto" && child.scrollHeight > child.clientHeight)), "Short viewports must scroll inside profile");
  await teacherProfile.screenshot({ path: path.join(outDir, "school-teacher-profile-mobile.png") });
  await detail.page.setViewportSize({ width: 1280, height: 720 });
  await teacherProfile.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(className).toHaveValue("Unsaved class draft");
  await detail.page.getByRole("button", { name: "Xem hồ sơ Student 01", exact: true }).click();
  const studentProfile = detail.page.getByRole("dialog");
  await expect(studentProfile.getByRole("heading", { name: "Student 01", exact: true })).toBeVisible();
  await expect(studentProfile.getByText("Lớp đang học", { exact: true })).toBeVisible();
  await studentProfile.getByRole("button", { name: "Đóng", exact: true }).click();
  assert.equal(countRequests(detail, "/schools/" + schoolId + "/users/200/profile"), 1);
  results.push("School class: teacher and student names open read-only profiles without losing form drafts PASS");
  await detail.page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
  await expect(detail.page.getByRole("heading", { name: "Bảng điểm Class 01" })).toBeVisible();
  await detail.page.getByRole("button", { name: "Thông tin lớp", exact: true }).click();
  await expect(detail.page.getByRole("heading", { name: "Chi tiết lớp học", exact: true })).toBeVisible();
  await detail.page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
  await expect(detail.page.getByRole("heading", { name: "Bảng điểm Class 01" })).toBeVisible();
  assert.equal(countRequests(detail, detailApi + "/grades"), 1);
  assert.equal(detail.errors.length, 0, detail.errors.join("\n"));
  results.push("School class and grades: cached return and realtime preserves unsaved class fields PASS");
  await detail.context.close();

  const billing = await fixture("SCHOOL", "/school/billing");
  await expect(billing.page.getByRole("heading", { name: "Lịch sử thanh toán", exact: true })).toBeVisible();
  await navigate(billing.page, "/school/users");
  await expect(billing.page.getByText("Student 01", { exact: true })).toBeVisible();
  await navigate(billing.page, "/school/billing");
  await expect(billing.page.getByRole("heading", { name: "Lịch sử thanh toán", exact: true })).toBeVisible();
  assert.equal(countRequests(billing, "/school/billing"), 1);
  assert.equal(countRequests(billing, "/auth/plans"), 1);
  await billing.page.getByRole("button", { name: "Lấy báo giá", exact: true }).click();
  await expect.poll(() => billing.requests.filter(item => item.includes("/billing/quote")).length).toBe(1);
  await expect(billing.page.getByRole("button", { name: "Lấy báo giá", exact: true })).toBeEnabled();
  await billing.page.getByRole("button", { name: "Lấy báo giá", exact: true }).click();
  await expect.poll(() => billing.requests.filter(item => item.includes("/billing/quote")).length).toBe(2);
  assert.equal(billing.errors.length, 0, billing.errors.join("\n"));
  results.push("School billing: cached display; each quote still verifies with the server PASS");
  await billing.context.close();

  const catalogue = await fixture("MANAGER", "/manager/plans");
  await expect(catalogue.page.getByText("Fixture plan", { exact: true })).toBeVisible();
  await navigate(catalogue.page, "/manager/curriculum");
  await expect.poll(() => countRequests(catalogue, "/admin/curriculum")).toBe(1);
  await navigate(catalogue.page, "/manager/plans");
  await expect(catalogue.page.getByText("Fixture plan", { exact: true })).toBeVisible();
  await navigate(catalogue.page, "/manager/curriculum");
  await expect(catalogue.page.getByRole("button", { name: /Thêm/ }).first()).toBeVisible();
  assert.equal(countRequests(catalogue, "/admin/plans"), 1);
  assert.equal(countRequests(catalogue, "/admin/curriculum"), 1);
  assert.equal(catalogue.errors.length, 0, catalogue.errors.join("\n"));
  results.push("Manager plans and curriculum: route return reuses cached data PASS");
  await catalogue.context.close();

  const reviewer = await fixture("REVIEWER", "/reviewer");
  await expect(reviewer.page.getByRole("heading", { level: 1 })).toBeVisible();
  await navigate(reviewer.page, "/reviewer/complaints");
  await expect(reviewer.page.getByRole("heading", { name: "Khiếu nại mô phỏng", exact: true })).toBeVisible();
  await navigate(reviewer.page, "/reviewer/gaps");
  await expect(reviewer.page.getByRole("heading", { name: "Định luật còn thiếu", exact: true })).toBeVisible();
  await navigate(reviewer.page, "/reviewer");
  await expect(reviewer.page.getByRole("heading", { level: 1 })).toBeVisible();
  assert.equal(countRequests(reviewer, "/support/complaints/review"), 1);
  assert.equal(countRequests(reviewer, "/reviewer/law-gaps?status=OPEN"), 1);
  assert.equal(countRequests(reviewer, "/reviewer/library?status=PENDING"), 1);
  assert.equal(reviewer.errors.length, 0, reviewer.errors.join("\n"));
  results.push("Reviewer overview, badges and desks share cached requests PASS");
  await reviewer.context.close();

  const admin = await fixture("ADMIN", "/admin");
  await expect(admin.page.getByRole("link", { name: "Tài khoản người dùng", exact: true })).toBeVisible();
  await expect.poll(() => countRequests(admin, "/admin/analytics")).toBe(1);
  await navigate(admin.page, "/admin/users");
  await expect(admin.page.getByRole("table").getByText("Student 01", { exact: true })).toBeVisible();
  await navigate(admin.page, "/admin");
  await expect(admin.page.getByRole("link", { name: "Tài khoản người dùng", exact: true })).toBeVisible();
  assert.equal(countRequests(admin, "/admin/analytics"), 1);
  assert.equal(countRequests(admin, "/admin/users"), 1);
  assert.equal(admin.errors.length, 0, admin.errors.join("\n"));
  results.push("Admin overview: cached analytics and accounts when returning PASS");
  await admin.context.close();

  const learner = await fixture("STUDENT", "/student");
  await expect.poll(() => countRequests(learner, "/assignments/mine/student")).toBe(1);
  await navigate(learner.page, "/support");
  await expect(learner.page.getByRole("heading", { name: "Hỗ trợ & khiếu nại của tôi", exact: true })).toBeVisible();
  await navigate(learner.page, "/student/community");
  await expect(learner.page.getByRole("heading", { name: "Kho mô phỏng", exact: true })).toBeVisible();
  await navigate(learner.page, "/support");
  await expect(learner.page.getByRole("heading", { name: "Hỗ trợ & khiếu nại của tôi", exact: true })).toBeVisible();
  await navigate(learner.page, "/student/community");
  await expect(learner.page.getByRole("heading", { name: "Kho mô phỏng", exact: true })).toBeVisible();
  assert.equal(countRequests(learner, "/assignments/mine/student"), 1);
  assert.equal(countRequests(learner, "/student/classes"), 1);
  assert.equal(countRequests(learner, "/library/community"), 1);
  assert.equal(countRequests(learner, "/support/mine"), 1);
  assert.equal(countRequests(learner, "/appeals/my"), 1);
  assert.equal(learner.errors.length, 0, learner.errors.join("\n"));
  results.push("Student lists, community and support reuse cache across area navigation PASS");
  await learner.context.close();
  const teacher = await fixture("STAFF", "/workspace/assignments");
  await expect(teacher.page.getByRole("heading", { name: "Fixture assignment", exact: true })).toBeVisible();
  await expect.poll(() => countRequests(teacher, "/assignments/assignment-1/submissions")).toBe(1);
  await navigate(teacher.page, "/workspace/complaints");
  await expect(teacher.page.getByRole("heading", { name: "Khiếu nại đã gửi", exact: true })).toBeVisible();
  await teacher.page.getByRole("navigation", { name: "Điều hướng workspace" }).getByRole("link", { name: "Cộng đồng", exact: true }).click();
  await expect(teacher.page).toHaveURL(url + "/community");
  await expect(teacher.page.getByRole("heading", { level: 1, name: "Kho cộng đồng", exact: true })).toBeVisible();
  await navigate(teacher.page, "/workspace/library");
  await expect(teacher.page.getByRole("heading", { name: "Mô phỏng của tôi", exact: true })).toBeVisible();
  await navigate(teacher.page, "/assignments/workspace");
  await expect.poll(() => countRequests(teacher, "/assignments/mine/teacher/classes")).toBe(1);
  await navigate(teacher.page, "/lab");
  await expect(teacher.page).toHaveURL(url + "/workspace");
  await expect(teacher.page.getByRole("region", { name: "Bài giao gần đây" }).getByRole("link", { name: /Fixture assignment/ })).toBeVisible();
  await expect.poll(() => countRequests(teacher, "/assignments/mine/teacher/progress")).toBe(1);
  assert.equal(countRequests(teacher, "/assignments/mine/teacher"), 1);
  assert.equal(countRequests(teacher, "/assignments/assignment-1/submissions"), 1);
  assert.equal(countRequests(teacher, "/user/students"), 1);
  await navigate(teacher.page, "/workspace/community");
  await expect(teacher.page).toHaveURL(url + "/community");
  await expect(teacher.page.getByRole("heading", { level: 1, name: "Kho cộng đồng", exact: true })).toBeVisible();
  assert.equal(countRequests(teacher, "/library/community"), 1);
  assert.equal(teacher.errors.length, 0, teacher.errors.join("\n"));
  results.push("Teacher assignments, submissions, library, community and complaints reuse cached data PASS");
  await teacher.context.close();
  const replacement = await fixture("SCHOOL", "/school/classes/" + classrooms[0].id + "?mode=edit", false, true);
  await replacement.page.getByRole("button", { name: "Chọn giáo viên thay thế", exact: true }).click();
  await replacement.page.getByRole("option", { name: /Next teacher/ }).click();
  await replacement.page.getByRole("button", { name: "Thay giáo viên", exact: true }).click();
  const confirmation = replacement.page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  assert.equal(replacement.writes.length, 0, "Opening confirmation must not mutate membership");
  await confirmation.getByRole("button", { name: "Xác nhận thay giáo viên", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(replacement.page.getByRole("button", { name: "Xem hồ sơ Next teacher", exact: true })).toBeVisible();
  assert.deepEqual(replacement.writes.map(item => ({ method: item.method, body: item.body })), [{ method: "PUT", body: { teacherId: 201, expectedTeacherId: 200 } }]);
  assert.equal(replacement.errors.length, 0, replacement.errors.join("\n"));
  await replacement.page.screenshot({ path: path.join(outDir, "teacher-replaced.png"), fullPage: true });
  await navigate(replacement.page, "/school/classes/" + classrooms[0].id + "?view=grades");
  const gradePanel = replacement.page.getByRole("region", { name: "Bảng điểm lớp học", exact: true });
  await expect(gradePanel.getByRole("combobox", { name: "Thành viên lớp" })).toHaveText("Đang học trong lớp");
  await expect(gradePanel.getByRole("button", { name: "Student 02 - Fixture assignment: 7/10", exact: true })).toHaveCount(0);
  await gradePanel.getByRole("combobox", { name: "Thành viên lớp" }).click();
  await replacement.page.getByRole("option", { name: "Đã rời lớp", exact: true }).click();
  await expect(gradePanel.getByRole("button", { name: "Student 02 - Fixture assignment: 7/10", exact: true })).toBeVisible();
  await expect(gradePanel.getByRole("button", { name: "Student 01 - Fixture assignment: 8/10", exact: true })).toHaveCount(0);
  await gradePanel.getByRole("combobox", { name: "Thành viên lớp" }).click();
  await replacement.page.getByRole("option", { name: "Tất cả học sinh", exact: true }).click();
  await expect(gradePanel.getByRole("button", { name: "Student 01 - Fixture assignment: 8/10", exact: true })).toBeVisible();
  await expect(gradePanel.getByRole("button", { name: "Student 02 - Fixture assignment: 7/10", exact: true })).toBeVisible();
  await replacement.page.screenshot({ path: path.join(outDir, "school-gradebook-updated.png"), fullPage: true, animations: "disabled" });
  await replacement.page.getByRole("button", { name: "Student 01 - Fixture assignment: 8/10", exact: true }).click();
  const gradeDialog = replacement.page.getByRole("dialog", { name: "Chi tiết kết quả học tập", exact: true });
  await expect(gradeDialog.getByRole("heading", { name: "Lịch sử chấm và sửa điểm", exact: true })).toBeVisible();
  await expect(gradeDialog.getByText(/Chưa có lịch sử được ghi nhận/)).toBeVisible();
  assert.ok(replacement.requests.some(item => item.includes("/submissions/submission-1/grade-history")), "School grade detail must request the protected history endpoint");
  results.push("Teacher replacement: confirmation, single atomic PUT and refreshed membership PASS");
  await replacement.context.close();

  const grading = await fixture("STAFF", "/workspace/assignments", false, true);
  const roster = grading.page.locator(".lab-submission-table");
  await expect(roster.locator("tbody > tr")).toHaveCount(4);
  const heights = await roster.locator("tbody > tr").evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
  assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, "Short, long, pending and empty submissions must use equal row heights");
  await expect(roster.getByText(/END OF FULL CONCLUSION/)).toHaveCount(0);
  await grading.page.screenshot({ path: path.join(outDir, "teacher-compact-roster.png"), fullPage: true, animations: "disabled" });
  await grading.page.getByRole("button", { name: "Sửa điểm", exact: true }).click();
  const reviewDialog = grading.page.getByRole("dialog", { name: "Bài làm của Student 01", exact: true });
  await expect(reviewDialog.getByText(/END OF FULL CONCLUSION/)).toBeAttached();
  await grading.page.screenshot({ path: path.join(outDir, "teacher-grading-dialog.png"), fullPage: true, animations: "disabled" });
  const gradeForm = grading.page.locator("form.lab-grading-form");
  await gradeForm.getByLabel("Điểm", { exact: true }).fill("9");
  await gradeForm.getByRole("button", { name: "Xác nhận điểm", exact: true }).click();
  assert.equal(grading.writes.length, 0, "Confirmed grades require a reason");
  await gradeForm.getByLabel(/Lý do thay đổi/).fill("Reviewed the explanation");
  await gradeForm.getByRole("button", { name: "Xác nhận điểm", exact: true }).click();
  await expect(grading.page.getByText("9/10", { exact: true })).toBeVisible();
  assert.equal(grading.writes[0].body.reason, "Reviewed the explanation");
  await roster.locator("tbody > tr").first().getByRole("button", { name: "Lịch sử điểm", exact: true }).click();
  const historyPanel = grading.page.getByRole("region", { name: "Lịch sử chấm và sửa điểm", exact: true });
  await expect(historyPanel.getByText(/Reviewed the explanation/)).toBeVisible();
  await expect(historyPanel.getByText(/Người chấm trước: Fixture teacher/)).toBeVisible();
  assert.ok(await grading.page.locator(".lab-submission-table-wrapper").evaluate(element => element.scrollWidth <= element.clientWidth + 1), "Grade history must fit the submission panel without horizontal clipping");
  await grading.page.screenshot({ path: path.join(outDir, "grade-history.png"), fullPage: true });
  await grading.page.setViewportSize({ width: 390, height: 844 });
  await expect(historyPanel).toBeVisible();
  assert.ok(await grading.page.locator(".lab-submission-table-wrapper").evaluate(element => element.scrollWidth <= element.clientWidth + 1), "Mobile grade history must fit its panel");
  await grading.page.screenshot({ path: path.join(outDir, "grade-history-mobile.png"), fullPage: true });
  await grading.page.setViewportSize({ width: 1280, height: 720 });
  await grading.page.getByRole("tab", { name: "Bài làm & chấm điểm", exact: true }).click();
  await gradeForm.getByLabel(/Lý do thay đổi/).fill("Please explain the prediction again");
  await gradeForm.getByRole("button", { name: "Trả bài làm lại", exact: true }).click();
  assert.equal(grading.writes.length, 1, "Returning work requires confirmation");
  await gradeForm.getByRole("button", { name: "Xác nhận trả bài", exact: true }).click();
  await expect(grading.page.getByText(/Đã trả bài cho Student 01/)).toBeVisible();
  assert.equal(grading.writes[1].body.reason, "Please explain the prediction again");
  assert.equal(grading.errors.length, 0, grading.errors.join("\n"));
  results.push("Grading after handover: mandatory reason, original grader history and confirmed return PASS");
  await grading.context.close();
  const schoolReceiver = await fixture("SCHOOL", "/school/appeals", false, false, true, true);
  await expect(schoolReceiver.page.getByText("Không có yêu cầu phù hợp.", { exact: true })).toBeVisible();
  const receiverMenu = schoolReceiver.page.getByRole("link", { name: /Yêu cầu mở khóa/ });
  await expect(receiverMenu).not.toContainText("1");
  onAppealCreated = schoolReceiver.receiveAppeal;
  const appealSender = await fixture("STAFF", "/support", false, false, true);
  await appealSender.page.getByRole("button", { name: "Gửi khiếu nại tài khoản", exact: true }).click();
  const appealDialog = appealSender.page.getByRole("dialog", { name: "Khiếu nại tài khoản tạm khóa", exact: true });
  await appealDialog.getByPlaceholder("Mô tả hoàn cảnh, bằng chứng hoặc cam kết khắc phục vi phạm…").fill("Please review the evidence");
  const picture = { name: "proof.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=", "base64") };
  await appealDialog.locator('input[type="file"]').setInputFiles([picture, picture, picture, picture]);
  await expect(appealDialog.getByText("Chỉ được chọn tối đa 3 ảnh.", { exact: true })).toBeVisible();
  await appealDialog.locator('input[type="file"]').setInputFiles(picture);
  await expect(appealDialog.getByRole("img", { name: "proof.png", exact: true })).toBeVisible();
  await expect.poll(() => appealDialog.getByRole("img", { name: "proof.png", exact: true }).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await appealSender.page.screenshot({ path: path.join(outDir, "appeal-evidence-upload.png"), fullPage: true, animations: "disabled" });
  const releaseAppeal = appealSender.holdNext("/api/appeals");
  await appealDialog.getByRole("button", { name: "Gửi đơn khiếu nại", exact: true }).click();
  await expect(appealDialog.locator('button[type="submit"]')).toBeDisabled();
  await expect(appealDialog.getByRole("status").filter({ hasText: /Đang tải ảnh|Đã tải ảnh/ })).toBeVisible();
  releaseAppeal();
  await expect(appealDialog.getByText(/Đã gửi đơn khiếu nại thành công/)).toBeVisible();
  await expect(receiverMenu).toContainText("1", { timeout: 3000 });
  await expect(schoolReceiver.page.getByRole("button", { name: "Xem yêu cầu", exact: true })).toBeVisible({ timeout: 3000 });
  assert.equal(schoolReceiver.errors.length, 0, schoolReceiver.errors.join("\n"));
  results.push("Two isolated browser sessions: teacher submit pushes school badge and inbox without refresh or polling PASS");
  onAppealCreated = () => { };
  await schoolReceiver.context.close();
  const upload = appealSender.writes.find(item => item.api === "/api/appeals");
  assert.ok(upload?.body.includes('name="files"; filename="proof.png"'));
  assert.ok(upload?.body.includes("Please review the evidence"));
  await appealDialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await appealSender.page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  await expect(appealSender.page.getByRole("img", { name: "Ảnh minh chứng 1", exact: true })).toBeVisible();
  assert.equal(appealSender.errors.length, 0, appealSender.errors.join("\n"));
  results.push("Suspended sender: validates picture limits, previews, sends multipart and views private evidence PASS");
  await appealSender.context.close();

  const appealHandler = await fixture("SCHOOL", "/school/appeals", false, false, true);
  const appealMenu = appealHandler.page.getByRole("link", { name: /Yêu cầu mở khóa/ });
  await expect(appealMenu).toContainText("1");
  await appealHandler.page.getByRole("button", { name: "Xem yêu cầu", exact: true }).click();
  const handlerDialog = appealHandler.page.getByRole("dialog");
  await expect(handlerDialog.getByRole("img", { name: "Ảnh minh chứng 1", exact: true })).toBeVisible();
  await appealHandler.page.screenshot({ path: path.join(outDir, "school-appeal-evidence.png"), fullPage: true, animations: "disabled" });
  await handlerDialog.getByLabel("Phản hồi / lý do xử lý").fill("Reviewed evidence");
  await handlerDialog.getByRole("button", { name: "Duyệt & mở khóa", exact: true }).click();
  await expect(handlerDialog).toBeHidden();
  await expect(appealMenu).not.toContainText("1");
  assert.equal(appealHandler.errors.length, 0, appealHandler.errors.join("\n"));
  results.push("School appeal badge: pending 1, protected evidence and badge cleared after resolution PASS");
  await appealHandler.context.close();
  const missedEvent = await fixture("SCHOOL", "/school/appeals", false, false, true, true);
  await expect(missedEvent.page.getByText("Không có yêu cầu phù hợp.", { exact: true })).toBeVisible();
  const missedMenu = missedEvent.page.getByRole("link", { name: /Yêu cầu mở khóa/ });
  await expect(missedMenu).not.toContainText("1");
  missedEvent.receiveAppeal(); revision++; // No SSE event: reproduce a lost notification.
  await expect(missedMenu).toContainText("1", { timeout: 8000 });
  await expect(missedEvent.page.getByRole("button", { name: "Xem yêu cầu", exact: true })).toBeVisible({ timeout: 8000 });
  missedEvent.receiveAppeal("Updated request while pending count stays one"); revision++;
  await expect(missedEvent.page.getByRole("cell", { name: "Updated request while pending count stays one", exact: true })).toBeVisible({ timeout: 8000 });
  await expect(missedMenu).toContainText("1");
  assert.equal(missedEvent.errors.length, 0, missedEvent.errors.join("\n"));
  results.push("Lost SSE recovery: badge and list stay synchronized, including changes with the same pending count PASS");
  await missedEvent.context.close();
  const schoolAccountList = await fixture("SCHOOL", "/school/users");
  await schoolAccountList.page.getByRole("combobox", { name: "Lọc theo đối tượng người dùng" }).click();
  await schoolAccountList.page.getByRole("option", { name: "Quản lý trường", exact: true }).click();
  const ownAccount = schoolAccountList.page.getByRole("row").filter({ hasText: "school@test.invalid" });
  await expect(ownAccount).toBeVisible();
  await expect(ownAccount.getByText("Chỉ xem", { exact: true })).toBeVisible();
  await expect(ownAccount.getByRole("button")).toHaveCount(0);
  await expect(ownAccount).not.toContainText("1980");
  assert.equal(schoolAccountList.errors.length, 0, schoolAccountList.errors.join("\n"));
  results.push("School account list: school role is visible and read-only; birth date is absent PASS");
  await schoolAccountList.context.close();
  }
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
