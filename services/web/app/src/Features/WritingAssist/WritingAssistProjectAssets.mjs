import {
  validateProjectPath,
  MAX_PROJECT_ASSET_BYTES,
  MAX_PROJECT_ASSETS_BYTES,
} from "@overleaf/validation-tools/project-input.mjs";
import { AgentError } from "./WritingAssistAgentService.mjs";

// Called only after project write authorization. Resolve blob identities from
// that project's entity listing; never accept a client-supplied URL or hash.
export async function collectProjectAssets(
  projectId,
  { listEntities, readBlob },
) {
  const { files } = await listEntities(projectId);
  if (files.length > 100)
    throw new AgentError(422, "Project has more than 100 attachments");
  const selected = files.map(({ path, file }) => {
    const normalized = path.replace(/^\//, "");
    try {
      validateProjectPath(normalized, true);
    } catch {
      throw new AgentError(
        422,
        `Unsupported project attachment: ${normalized}`,
      );
    }
    if (typeof file.hash !== "string" || !/^[a-f0-9]{40,64}$/i.test(file.hash))
      throw new AgentError(422, "Project attachment has no valid stored hash");
    return { path: normalized, hash: file.hash };
  });
  const result = [];
  let total = 0;
  const deadline = AbortSignal.timeout(30000);
  for (const file of selected) {
    const { stream } = await readBlob(projectId, file.hash, deadline);
    const abort = () =>
      stream.destroy(new Error("Project attachment download timed out"));
    deadline.addEventListener("abort", abort, { once: true });
    if (deadline.aborted) abort();
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of stream) {
        size += chunk.length;
        total += chunk.length;
        if (size > MAX_PROJECT_ASSET_BYTES || total > MAX_PROJECT_ASSETS_BYTES)
          throw new AgentError(
            422,
            "Project attachments exceed the 10 MiB per file / 20 MiB total limit",
          );
        chunks.push(chunk);
      }
      result.push({
        path: file.path,
        data: Buffer.concat(chunks).toString("base64"),
      });
    } finally {
      deadline.removeEventListener("abort", abort);
      stream.destroy();
    }
  }
  return result;
}
