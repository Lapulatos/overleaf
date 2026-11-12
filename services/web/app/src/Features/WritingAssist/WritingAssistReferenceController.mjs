import { parseReferenceFile } from './WritingAssistReferenceImport.mjs';
import { completeEntry } from './WritingAssistReferenceCompletion.mjs';
import { expressify } from "@overleaf/promise-utils";
import SessionManager from "../Authentication/SessionManager.mjs";
import AuthorizationManager from "../Authorization/AuthorizationManager.mjs";
import { z, parseReq } from "../../infrastructure/Validation.mjs";
import { AgentError } from "./WritingAssistAgentService.mjs";
import {
  agentService,
  agentStore,
  readWorkspaceIdentity,
  snapshot,
} from "./WritingAssistAgentController.mjs";
import { createLiteratureService } from "./WritingAssistLiteratureService.mjs";
import { createReferenceService } from "./WritingAssistReferenceService.mjs";
import { createCitationService } from "./WritingAssistCitationService.mjs";
import { parseBibliography, readableBibText } from "./WritingAssistBibTeX.mjs";
import { citationKey } from "./WritingAssistCitationKey.mjs";
const canWrite = (u, p) =>
  AuthorizationManager.promises.canUserWriteProjectContent(u, p);
const service = createReferenceService({
  readWorkspaceIdentity,
  canWrite,
  snapshot,
  literature: createLiteratureService({ canWrite }),
  tasks: agentService,
  store: agentStore,
});
const params = z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i) });
const schemas = {
  inventory: z.object({ params }),
  applyClaim: z.object({params,body:z.object({taskId:z.string().uuid(),suggestionId:z.string().min(1).max(100)})}),
  apply: z.object({ params, body: z.object({
    taskId: z.string().uuid(),
    fields: z.array(z.object({ key: z.string().min(1).max(256), field: z.string().min(1).max(64) })).min(1).max(250),
  }) }),
  start: z.object({
    params,
    body: z.object({
      mode: z.enum(["metadata", "claims", "format", "complete"]),
      docId: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
      keys: z.array(z.string().min(1).max(256)).min(1).max(10).optional(),
      model: z.string().max(128).optional(),
      effort: z.string().max(32).optional(),
    }),
  }),
  import: z.object({
    params,
    body: z.object({
      bibtex: z.string().min(1).max(200000),
      enrich: z.boolean().optional(),
      destination: z.object({
        docId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
        newName: z.string().max(124).optional(),
      }),
    }),
  }),
};
function handler(action) {
  return expressify(async (req, res) => {
    const parsed = parseReq(req, schemas[action]);
    const user = SessionManager.getLoggedInUserId(req.session).toString();
    const project = parsed.params.projectId;
    try {
      let result;
      if (action === "inventory")
        result = await service.inventory(user, project);
      else if (action === "applyClaim")
        result = await service.applyClaim(user, project, parsed.body);
      else if (action === "apply")
        result = await service.apply(user, project, parsed.body);
      else if (action === "start")
        result = await service.start(user, project, parsed.body);
      else {
        if (!(await canWrite(user, project)))
          throw new AgentError(403, "Project write access required");
        const parsedBib = parseReferenceFile(parsed.body.bibtex);
        const importNotes = [...parsedBib.warnings];
        const provider = createLiteratureService({ canWrite });
        if (parsed.body.enrich) {
          for (let offset = 0; offset < parsedBib.entries.length; offset += 5) {
            await Promise.all(parsedBib.entries.slice(offset, offset + 5).map(async (entry) => {
              const doi = readableBibText(entry.fields.doi || '').replace(/^https?:\/\/(?:dx\.)?doi.org\//i, '');
              if (!doi) { importNotes.push(`${entry.key}: no DOI; imported file metadata remains unverified`); return; }
              try {
                const citation = await provider.lookup(user, project, doi);
                const completion = completeEntry(entry, citation);
                const replacement = parseBibliography(completion.raw).entries[0];
                Object.assign(entry, replacement);
                importNotes.push(`${entry.key}: checked DOI; ${completion.changes.length} proposed field changes. Source: ${citation.sourceUrl}`);
              } catch (error) {
                if (!(error instanceof AgentError)) throw error;
                importNotes.push(`${entry.key}: online verification unavailable; original file metadata retained`);
              }
            }));
          }
        }
        if (
          parsedBib.special.some((type) => type !== "comment") ||
          parsedBib.entries.some((e) => e.unresolved.length || ['crossref','xdata','entryset'].some(field => e.fields[field]))
        )
          throw new AgentError(
            422,
            "Use self-contained BibTeX entries with literal field values; resolve string macros, inherited fields and preambles before importing",
          );
        if (!parsedBib.entries.length || parsedBib.entries.length > 50)
          throw new AgentError(422, "Import 1–50 references at a time");
        const imported = parsedBib.entries.map((entry, index) => {
          const title = readableBibText(entry.fields.title || "");
          if (!title) throw new AgentError(422, "Each reference needs a title");
          const person = readableBibText(entry.fields.author || "").split(
            /\s+and\s+/i,
          )[0];
          const family = person.includes(",")
            ? person.split(",")[0]
            : person.trim().split(/\s+/).at(-1);
          const year = /^\d{4}$/.test(entry.fields.year || "")
            ? Number(entry.fields.year)
            : null;
          const key = citationKey({
            authors: family ? [{ family }] : [],
            year,
            title,
          });
          const doi =
            readableBibText(entry.fields.doi || "").replace(
              /^https?:\/\/(?:dx\.)?doi.org\//i,
              "",
            ) || null;
          let raw = entry.raw;
          const pages = entry.spans.pages;
          if (pages && !entry.unresolved.includes('pages')) {
            const normalized = entry.fields.pages.replace(/(\d)\s*[-–—]+\s*(?=\d)/g, '$1--');
            raw = raw.slice(0, pages.start) + `{${normalized}}` + raw.slice(pages.end);
          }
          return {
            key,
            title,
            doi,
            source: `${parsedBib.format} import`,
            url: doi ? `https://doi.org/${doi}` : "",
            bibtex:
              raw.replace(
                /^(@\w+\s*[{(]\s*)[^\s,{}()]+/,
                (_, prefix) => prefix + key,
              ) + "\n",
            index,
          };
        });
        const citations = createCitationService({
          readWorkspaceIdentity,
          canWrite,
          snapshot,
          store: agentStore,
          tasks: agentService,
          literature: { lookup: async (u, p, index) => imported[index] },
        });
        result = await citations.preview(
          user,
          project,
          imported.map((e) => e.index),
          parsed.body.destination,
          { importNotes: [`Detected ${parsedBib.format}; ${parsedBib.entries.length} references.`, ...importNotes] },
        );
      }
      res.status(action === "inventory" ? 200 : 201).json(result);
    } catch (error) {
      if (!(error instanceof AgentError)) throw error;
      res.status(error.status).json({ error: error.message });
    }
  });
}
export default {
  inventory: handler("inventory"),
  apply: handler("apply"),
  applyClaim: handler("applyClaim"),
  start: handler("start"),
  import: handler("import"),
};
