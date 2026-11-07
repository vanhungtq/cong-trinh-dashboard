import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, request } from "../src/api";

test("API requests stop Access redirects and preserve same-origin authentication", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.redirect, "manual");
      assert.equal(options?.credentials, "same-origin");
      assert.equal(
        (options?.headers as Record<string, string>)["X-Requested-With"],
        "XMLHttpRequest",
      );
      return Response.json([{ id: "board" }]);
    };
    assert.deepEqual(await request("/trello/boards?workspaceId=demo"), [
      { id: "board" },
    ]);
    globalThis.fetch = async () =>
      ({ type: "opaqueredirect", status: 0 }) as Response;
    await assert.rejects(
      request("/trello/boards"),
      (e: unknown) => e instanceof ApiError && e.kind === "auth",
    );
    globalThis.fetch = async () => new Response("Login", { status: 401 });
    await assert.rejects(request("/trello/boards"), /Cloudflare Access/);
    globalThis.fetch = async () => new Response("Blocked", { status: 403 });
    await assert.rejects(request("/trello/boards"), /Cloudflare từ chối/);
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(
      request("/trello/boards"),
      (e: unknown) =>
        e instanceof ApiError &&
        e.kind === "network" &&
        !e.message.includes("Failed to fetch"),
    );
    globalThis.fetch = async () =>
      Response.json({ error: "Bạn không có quyền" }, { status: 403 });
    await assert.rejects(
      request("/trello/boards"),
      (e: unknown) =>
        e instanceof ApiError &&
        e.kind === "server" &&
        e.message === "Bạn không có quyền",
    );
  } finally {
    globalThis.fetch = previous;
  }
});
