import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  rm,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import Path from "node:path";
import { GitRepository, remoteUrl } from "./GitRepository.mjs";
import { validateCloneResources } from "./CloneResources.mjs";

// All destinations are server-generated. Retries reuse the operation and project IDs.
export async function cloneRepository(
  source,
  userId,
  input,
  { createProject, context },
) {
  if (
    !/^[a-f0-9]{24}$/i.test(userId) ||
    !/^[-a-f0-9]{36}$/i.test(input.operationId)
  )
    throw new Error("Invalid clone identity");
  const url = remoteUrl(input.url, source.repository.allowLocalRemotes);
  if (!!input.username !== !!input.token)
    throw new Error("Provide both username and access token");
  const specification = { url, branch: input.branch || null, name: input.name };
  return source.withLock(async () => {
    const root = Path.join(source.root, "clones", userId, input.operationId);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const file = Path.join(root, "operation.json");
    const save = async (state) => {
      await writeFile(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
      await rename(file + ".tmp", file);
    };
    let state;
    try {
      state = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      state = { specification };
      await save(state);
    }
    if (JSON.stringify(state.specification) !== JSON.stringify(specification))
      throw Object.assign(
        new Error("Clone options changed. Start a new clone operation."),
        { status: 409 },
      );
    if (state.result) return state.result;
    const directory = Path.join(root, "repository");
    const credential = input.token
      ? { url, username: input.username, token: input.token }
      : await source.credentials.read(url);
    if (!state.cloned) {
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory);
      const clone = new GitRepository(directory, source.repository.options);
      await clone.withRemoteCredentials(url, credential, (repo) =>
        repo.clone(url, input.branch),
      );
      await validateCloneResources(clone); // Reject incomplete resources before creating a project.
      state.branch = (await clone.status()).branch;
      state.head = await clone.head().catch(() => null);
      state.cloned = true;
      await save(state);
    }
    if (!state.projectId) {
      // Also validate resumable operations created before this guard existed.
      await validateCloneResources(new GitRepository(directory, source.repository.options));
      state.projectId = randomBytes(12).toString("hex");
      await save(state);
    }
    await createProject(userId, input.name, state.projectId);
    const target = await context(state.projectId, userId);
    await target.withLock(async () => {
      const entries = await readdir(target.repository.directory);
      if (!entries.length) await rename(directory, target.repository.directory);
      else if (
        (await target.repository.remoteUrl("origin")) !== url ||
        (await target.repository.head().catch(() => null)) !== state.head
      )
        throw new Error(
          "The clone destination changed; refusing to replace it",
        );
      await validateCloneResources(target.repository);
      if (credential)
        await target.credentials.save(
          url,
          credential.username,
          credential.token,
        );
      let binding;
      try {
        binding = await target.store.read();
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (!binding) {
        const snapshot = await target.project.read();
        if (snapshot.files.size)
          throw new Error(
            "The new project already contains files; refusing to overwrite them",
          );
        const beforeDirectory = Path.join(
          target.root,
          "transfers",
          "clone-" + input.operationId,
        );
        await mkdir(beforeDirectory, { recursive: true, mode: 0o700 });
        await target.store.write({
          directory: target.repository.directory,
          branch: state.branch,
          pending: {
            directory: target.repository.directory,
            branch: state.branch,
            beforeDirectory,
          },
        });
      }
    });
    await target.workspace.resumeSwitch();
    state.result = {
      projectId: state.projectId,
      url: `/project/${state.projectId}`,
      branch: state.branch,
      head: state.head,
    };
    await save(state);
    return state.result;
  });
}
