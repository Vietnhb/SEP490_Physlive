import test from "node:test";
import assert from "node:assert/strict";
import { queryClient, apiKey, sessionScope, resetServerState, affectedBy, invalidateServerData } from "../src/shared/api/queryClient.ts";

globalThis.window = new EventTarget();
queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, gcTime: Infinity } });
test("concurrent readers share a request and fresh results are reused", async () => {
  resetServerState(); let requests = 0;
  const query = { queryKey: apiKey("/schemas"), queryFn: async () => { requests++; await new Promise(resolve => setTimeout(resolve, 10)); return ["catalogue"]; } };
  const result = await Promise.all([queryClient.fetchQuery(query), queryClient.fetchQuery(query)]);
  assert.deepEqual(result, [["catalogue"], ["catalogue"]]);
  await queryClient.fetchQuery(query); assert.equal(requests, 1);
});
test("session change discards cached and in-flight data", async () => {
  resetServerState(); const before = sessionScope(); const oldKey = apiKey("/admin/users/page?page=0");
  queryClient.setQueryData(oldKey, ["old-account"]);
  let complete; const waiting = queryClient.fetchQuery({ queryKey: apiKey("/pending"), queryFn: () => new Promise(resolve => { complete = resolve; }) });
  const rejected = assert.rejects(waiting);
  resetServerState(); complete(["late-old-account"]); await rejected;
  assert.ok(sessionScope() > before); assert.equal(queryClient.getQueryData(oldKey), undefined);
  assert.equal(queryClient.getQueryCache().getAll().length, 0);
});
test("invalidation updates matching domains without discarding unrelated data", () => {
  resetServerState(); const users = apiKey("/admin/users/page?page=0"); const schemas = apiKey("/schemas");
  queryClient.setQueryData(users, [1]); queryClient.setQueryData(schemas, [2]);
  invalidateServerData("/admin/users/1/restore");
  assert.equal(queryClient.getQueryState(users).isInvalidated, true);
  assert.equal(queryClient.getQueryState(schemas).isInvalidated, false);
  assert.deepEqual(queryClient.getQueryData(users), [1]);
});
test("payment, curriculum and assignment dependencies refresh their reports", () => {
  assert.ok(affectedBy("/admin/payment-analytics?year=2026", "/school/billing/checkout"));
  assert.ok(affectedBy("/school/billing", "/admin/plans/STARTER"));
  assert.ok(affectedBy("/schemas", "/reviewer/topics/1"));
  assert.ok(affectedBy("/schools/id/classes/id/grades", "/assignments/id/submissions/id"));
  assert.equal(affectedBy("/schemas", "/support/admin/1"), false);
  assert.equal(affectedBy("/admin/plans", "/admin/users/1/restore"), false);
  assert.equal(affectedBy("/schools/10000000-0000-0000-0000-000000000001/classes/page", "/schools/20000000-0000-0000-0000-000000000002/classes/id"), false);
  assert.ok(affectedBy("/anywhere", undefined));
  resetServerState();
});
