import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import Path from "node:path";
import { randomUUID } from "node:crypto";
import { GitRepository } from "../../app/src/Features/NativeGit/GitRepository.mjs";
import { cloneRepository } from "../../app/src/Features/NativeGit/CloneRepository.mjs";
import { WorkspaceStore } from "../../app/src/Features/NativeGit/WorkspaceStore.mjs";
import { ProjectWorkspace } from "../../app/src/Features/NativeGit/ProjectWorkspace.mjs";
const user = "a".repeat(24);
async function fixture(t) {
  const root = await mkdtemp(Path.join(tmpdir(), "git-clone-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repository = await GitRepository.init(Path.join(root, "source"), {
    allowLocalRemotes: true,
  });
  await repository.author("Clone Fixture", "clone@example.test");
  await writeFile(
    Path.join(repository.directory, "main.tex"),
    "Original paper\n",
  );
  await repository.stage(["main.tex"]);
  await repository.commit("Initial");
  const remote = await GitRepository.init(Path.join(root, "remote"), {
    allowLocalRemotes: true,
  });
  await remote.author("Remote", "remote@example.test");
  await writeFile(Path.join(remote.directory, "main.tex"), "Cloned paper\n");
  await remote.stage(["main.tex"]);
  await remote.commit("Remote initial");
  return {
    root,
    remote,
    source: {
      root,
      repository,
      withLock: (fn) => fn(),
      credentials: { read: async () => undefined },
    },
  };
}
test("new project clone resumes partial import under the same project ID", async (t) => {
  const { source, remote, root } = await fixture(t),
    input = {
      operationId: randomUUID(),
      url: remote.directory,
      name: "New paper",
    };
  const projects = new Map();
  let fail = true;
  const deps = {
    createProject: async (owner, name, id) => {
      assert.equal(owner, user);
      if (!projects.has(id)) projects.set(id, { name, files: new Map() });
    },
    context: async (id) => {
      const projectRoot = Path.join(root, "projects", id);
      await mkdir(Path.join(projectRoot, "repository"), { recursive: true });
      const repository = new GitRepository(
          Path.join(projectRoot, "repository"),
          { allowLocalRemotes: true },
        ),
        store = new WorkspaceStore(Path.join(projectRoot, "binding"));
      const state = projects.get(id),
        project = {
          read: async () => ({ files: new Map(state.files) }),
          apply: async (changes) => {
            for (const change of changes) {
              if (change.after === undefined) state.files.delete(change.path);
              else state.files.set(change.path, change.after);
            }
            if (fail) {
              fail = false;
              throw Error("Simulated acknowledgement loss");
            }
          },
        };
      const withLock = (fn) => fn(),
        workspace = new ProjectWorkspace({
          repository,
          store,
          project,
          withLock,
          transferRoot: Path.join(projectRoot, "transfers"),
        });
      return {
        root: projectRoot,
        repository,
        store,
        project,
        withLock,
        workspace,
        credentials: { save: async () => {} },
      };
    },
  };
  await assert.rejects(
    cloneRepository(source, user, input, deps),
    /acknowledgement loss/,
  );
  const result = await cloneRepository(source, user, input, deps);
  assert.equal(projects.size, 1);
  assert.equal(
    projects.get(result.projectId).files.get("main.tex").toString(),
    "Cloned paper\n",
  );
  assert.equal(
    await readFile(Path.join(source.repository.directory, "main.tex"), "utf8"),
    "Original paper\n",
  );
  assert.deepEqual(await cloneRepository(source, user, input, deps), result);
  assert.equal(result.url, `/project/${result.projectId}`);
  const target = await deps.context(result.projectId);
  assert.equal(await target.repository.head(), await remote.head());
  assert.equal(await target.repository.remoteUrl("origin"), remote.directory);
  await assert.rejects(
    cloneRepository(source, user, { ...input, name: "Changed" }, deps),
    /options changed/,
  );
});
