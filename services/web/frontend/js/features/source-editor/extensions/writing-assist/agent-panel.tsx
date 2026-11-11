import "./agent-panel.css";
import {
  AgentTaskResult,
  message,
  type Task,
  type Proposal,
} from "./agent-task-result";
import { useEffect, useState } from "react";
import { LiteratureView } from "./literature-panel";
import { useProjectContext } from "@/shared/context/project-context";
import RailPanelHeader from "@/features/ide-react/components/rail/rail-panel-header";
import OLButton from "@/shared/components/ol/ol-button";
import { getJSON, postJSON, deleteJSON } from "@/infrastructure/fetch-json";

export function AgentTaskView({ projectId }: { projectId: string }) {
  const storageKey = `writing-assist-task:${projectId}`;
  const [taskId, setTaskId] = useState<string>(() => {
    try {
      return sessionStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  });
  const [task, setTask] = useState<Task | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const base = `/writing-assist/project/${encodeURIComponent(projectId)}/tasks`;
  const running = task?.status === "running" || Boolean(taskId && !task);

  useEffect(() => {
    try {
      if (taskId) sessionStorage.setItem(storageKey, taskId);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage may be disabled; the current task still works. */
    }
  }, [storageKey, taskId]);

  useEffect(() => {
    if (!taskId || busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await getJSON<Task>(`${base}/${taskId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || !result) return;
        setTask(result);
        if (result.status === "running") timer = setTimeout(poll, 1000);
      } catch (error) {
        if (!controller.signal.aborted) setError(message(error));
      }
    }
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [base, taskId, busy, refresh]);

  async function submit() {
    if (!instruction.trim() || busy || running) return;
    setBusy(true);
    setError("");
    try {
      const result = await postJSON<Task>(base, {
        body: { instruction: instruction.trim() },
      });
      setTask(result);
      setTaskId(result.taskId);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function act(proposal?: Proposal, accept?: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = proposal
        ? await postJSON<Task>(`${base}/${taskId}/proposals/${proposal.id}`, {
            body: { accept },
          })
        : await deleteJSON<Task>(`${base}/${taskId}`);
      setTask(result);
    } catch (error) {
      setError(message(error));
      if (proposal) {
        // The write may have succeeded despite a lost response. Read its state
        // once; never automatically repeat a mutation after a network failure.
        try {
          const latest = await getJSON<Task>(`${base}/${taskId}`);
          if (latest) {
            setTask(latest);
            const reviewed = latest.proposals.find(item => item.id === proposal.id);
            if (reviewed?.status === (accept ? "accepted" : "rejected")) {
              setError("");
            }
          }
        } catch {
          // Keep the original error and the last known state when offline.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        style={{
          padding: 12,
          overflowY: "auto",
          color: "var(--content-primary-themed)",
        }}
      >
        <p>
          Ask about this project or request a revision. Review each proposed
          file change before applying it.
        </p>
        <label htmlFor="paper-assistant-instruction">Instructions</label>
        <textarea
          id="paper-assistant-instruction"
          className="form-control"
          rows={4}
          maxLength={32000}
          value={instruction}
          disabled={busy || running}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Review the introduction and suggest clearer wording…"
        />
        <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
          <OLButton
            variant="primary"
            disabled={busy || running || !instruction.trim()}
            onClick={() => submit()}
          >
            Run task
          </OLButton>
          {running && (
            <OLButton disabled={busy} onClick={() => act()}>
              Cancel task
            </OLButton>
          )}
        </div>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <OLButton
              disabled={busy}
              onClick={() => {
                setError("");
                setRefresh((value) => value + 1);
              }}
            >
              Refresh task
            </OLButton>
            <OLButton
              disabled={busy}
              onClick={() => {
                setTaskId("");
                setTask(null);
                setError("");
              }}
            >
              Dismiss task view
            </OLButton>
          </div>
        )}
        {task && <AgentTaskResult task={task} busy={busy} act={act} />}
      </div>
    </>
  );
}

export default function AgentPanel() {
  const { projectId } = useProjectContext();
  return (
    <section
      className="paper-assistant-panel"
      aria-label="Paper Assistant workspace"
    >
      <RailPanelHeader title="References" />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to focus and scroll this bounded region. */}
      <div className="paper-assistant-scroll" role="region" aria-label="References content" tabIndex={0}>
        <LiteratureView key={projectId} projectId={projectId} />
      </div>
    </section>
  );
}
