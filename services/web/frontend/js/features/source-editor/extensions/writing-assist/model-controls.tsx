import { useEffect, useState } from "react";
import { getJSON } from "@/infrastructure/fetch-json";

type Model = {
  id: string;
  name: string;
  isDefault: boolean;
  defaultEffort: string;
  efforts: string[];
};
export type ModelSelection = { model?: string; effort?: string };
const projectSelections = new Map<string, ModelSelection>();
export function getProjectModelSelection(projectId: string): ModelSelection {
  return { ...projectSelections.get(projectId) };
}
export function ModelControls({
  projectId,
  disabled,
  onChange,
  compact = false,
}: {
  projectId: string;
  compact?: boolean;
  disabled: boolean;
  onChange: (selection: ModelSelection) => void;
}) {
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getJSON<{ models: Model[] }>(
      `/writing-assist/project/${encodeURIComponent(projectId)}/models`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted || !result) return;
        const preferred =
          result.models.find((item) => item.id === projectSelections.get(projectId)?.model) || result.models.find((item) => item.isDefault) || result.models[0];
        const savedEffort = projectSelections.get(projectId)?.effort;
        const nextEffort = savedEffort && preferred?.efforts.includes(savedEffort) ? savedEffort : preferred?.defaultEffort || "";
        const nextSelection = preferred ? { model: preferred.id, effort: nextEffort } : {};
        setModels(result.models);
        setModel(preferred?.id || "");
        setEffort(nextEffort);
        projectSelections.set(projectId, nextSelection);
        onChange(nextSelection);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [projectId, retry, onChange]);
  const selected = models.find((item) => item.id === model);
  return (
    <div
      className={`paper-model-controls${compact ? " paper-model-controls-compact" : ""}`}
    >
      {error ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry model list
        </button>
      ) : (
        <>
          <label>
            <span>Model</span>
            <select
              aria-label="Model"
              disabled={disabled || !models.length}
              value={model}
              onChange={(event) => {
                const next = models.find(
                  (item) => item.id === event.target.value,
                );
                if (!next) return;
                setModel(next.id);
                setEffort(next.defaultEffort);
                projectSelections.set(projectId, { model: next.id, effort: next.defaultEffort });
                onChange({ model: next.id, effort: next.defaultEffort });
              }}
            >
              {!models.length && <option value="">Loading…</option>}
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Reasoning</span>
            <select
              aria-label="Reasoning effort"
              disabled={disabled || !selected}
              value={effort}
              onChange={(event) => {
                setEffort(event.target.value);
                projectSelections.set(projectId, { model, effort: event.target.value });
                onChange({ model, effort: event.target.value });
              }}
            >
              {!selected && <option value="">Default</option>}
              {selected?.efforts.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
