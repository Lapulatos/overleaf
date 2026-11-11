import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { collectProjectAssets } from "../../app/src/Features/WritingAssist/WritingAssistProjectAssets.mjs";
const hash = "a".repeat(40);
test("project asset collection uses only listed project hashes and preserves binary bytes", async () => {
  const calls = [];
  const assets = await collectProjectAssets("project", {
    listEntities: async () => ({
      files: [{ path: "/figures/p.png", file: { hash } }],
    }),
    readBlob: async (...args) => {
      calls.push(args);
      return { stream: Readable.from([Buffer.from([0, 255, 1])]) };
    },
  });
  assert.equal(calls[0][0], "project");
  assert.equal(calls[0][1], hash);
  assert.equal(calls[0][2] instanceof AbortSignal, true);
  assert.deepEqual(assets, [{ path: "figures/p.png", data: "AP8B" }]);
});
test("invalid paths and untrusted hashes are rejected before blob requests", async () => {
  for (const file of [
    { path: "/../p.png", file: { hash } },
    { path: "/p.png", file: { hash: "https://elsewhere" } },
  ]) {
    await assert.rejects(
      collectProjectAssets("project", {
        listEntities: async () => ({ files: [file] }),
        readBlob: () => {
          throw new Error("must not fetch");
        },
      }),
      (error) => error.status === 422,
    );
  }
});
test("streaming file size limit terminates attachment download", async () => {
  const stream = Readable.from([
    Buffer.alloc(10 * 1024 * 1024),
    Buffer.from([1]),
  ]);
  await assert.rejects(
    collectProjectAssets("project", {
      listEntities: async () => ({
        files: [{ path: "/p.png", file: { hash } }],
      }),
      readBlob: async () => ({ stream }),
    }),
    /limit/,
  );
  assert.equal(stream.destroyed, true);
});
