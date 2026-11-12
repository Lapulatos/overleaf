import { replaceRecoveredTask } from './recovered-task'
import { ReferenceTaskView } from './reference-task-view';
import MaterialIcon from '@/shared/components/material-icon';
import { useEffect, useState, useRef } from "react";
import { deleteJSON, getJSON, postJSON } from "@/infrastructure/fetch-json";
import {
  message,
  type Task,
  type Proposal,
  type ReferenceFieldChoice,
} from "./agent-task-result";
import { getProjectModelSelection } from "./model-controls";

type Bibliography = {
  id: string;
  path: string;
  error: string | null;
  entries: { key: string; title: string; unresolved: string[] }[];
};
export function ReferenceTools({
  projectId,
}: {
  projectId: string;
}) {
  const base = `/writing-assist/project/${encodeURIComponent(projectId)}`;
  const storageKey = `reference-check:${projectId}`;
  const [bibliographies, setBibliographies] = useState<Bibliography[]>([]);
  const [docId, setDocId] = useState("");
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [task, setTask] = useState<Task | null>(null);
  const [taskId, setTaskId] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  });
  const [batchTasks,setBatchTasks]=useState<Task[]>([]);
  const [batchRunning,setBatchRunning]=useState(false);
  const [batchProgress,setBatchProgress]=useState<{done:number;total:number;batch:number;count:number}|null>(null);
  const batchController=useRef<AbortController|null>(null);
  const batchTaskId=useRef('');
  const batchGeneration=useRef(0);
  const batchStorageKey=`reference-batches:${projectId}`;
  useEffect(()=>{
    let alive=true;const generation=batchGeneration.current;
    try {const ids=JSON.parse(sessionStorage.getItem(batchStorageKey)||'[]') as string[];
      if(ids.length)Promise.all(ids.map(id=>getJSON<Task>(`${base}/tasks/${id}`))).then(tasks=>{if(alive && generation===batchGeneration.current)setBatchTasks(tasks)}).catch(()=>{});
    } catch { /* Invalid stored history is ignored. */ }
    return()=>{alive=false;batchController.current?.abort()};
  },[base,batchStorageKey]);
  function replaceTask(oldId:string,value:Task) {
    setTask(value);setTaskId(value.taskId);
    setBatchTasks(previous=>{const next=previous.map(t=>t.taskId===oldId?value:t);try{sessionStorage.setItem(batchStorageKey,JSON.stringify(next.map(t=>t.taskId)))}catch{}return next});
    try{sessionStorage.setItem(storageKey,value.taskId)}catch{}
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const running =
    batchRunning || busy || task?.status === "running" || Boolean(taskId && !task);
  const pending = task?.proposals.some((p) =>
    ["applying", "uncertain"].includes(p.status) || (p.status === "pending" && !task.referenceReview?.baseHash),
  );
  useEffect(() => {
    const controller = new AbortController();
    getJSON<Bibliography[]>(`${base}/references/inventory`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setBibliographies(value);
          setDocId((current) =>
            value.some((doc) => doc.id === current)
              ? current
              : value[0]?.id || "",
          );
          setKeys(new Set());
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [base, refresh]);
  useEffect(() => {
    if (!taskId || batchRunning) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await getJSON<Task>(`${base}/tasks/${taskId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setTask(value);
        setBatchTasks(previous=>previous.map(t=>t.taskId===value.taskId?value:t));
        setError("");
        if (value.status === "running") timer = setTimeout(poll, 1500);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(message(e));
          timer = setTimeout(poll, 3000);
        }
      }
    };
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [base, taskId, refresh, batchRunning]);
  async function start(mode: "metadata" | "claims" | "complete", target?: {docId: string; keys: string[]}) {
    if (running || pending || batchTasks.some(t=>t.proposals.some(p=>['applying','uncertain'].includes(p.status) || (p.status==='pending' && !t.referenceReview?.baseHash)))) return;
    batchGeneration.current++;
    const selected=target?.keys || [...keys];
    if(selected.length>10){await startBatch(mode,target?.docId || docId,selected);return;}
    setBatchTasks([]);setBatchProgress(null);try{sessionStorage.removeItem(batchStorageKey)}catch{}
    setBusy(true);
    setError("");
    try {
      const value = await postJSON<Task>(`${base}/references/tasks`, {
        body: {
          mode,
          docId: target?.docId || docId || undefined,
          keys: target?.keys || [...keys],
          ...getProjectModelSelection(projectId),
        },
      });
      setTask(value);
      setTaskId(value.taskId);
      try {
        sessionStorage.setItem(storageKey, value.taskId);
      } catch {
        /* Session-only when storage is unavailable. */
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function startBatch(mode:"metadata"|"claims"|"complete",selectedDoc:string,selected:string[]) {
    const controller=new AbortController();batchController.current=controller;setBatchRunning(true);setBatchTasks([]);setTask(null);setTaskId('');setError('');
    const count=Math.ceil(selected.length/10);const ids:string[]=[];const selection=getProjectModelSelection(projectId);
    try {sessionStorage.removeItem(batchStorageKey)}catch{}
    try {
      for(let index=0;index<count;index++){
        if(controller.signal.aborted)break;
        setBatchProgress({done:index*10,total:selected.length,batch:index+1,count});
        batchTaskId.current='';
        let value=await postJSON<Task>(`${base}/references/tasks`,{body:{mode,docId:selectedDoc,keys:selected.slice(index*10,index*10+10),...selection}});
        batchTaskId.current=value.taskId;ids.push(value.taskId);setTask(value);setTaskId(value.taskId);setBatchTasks(prev=>[...prev,value]);
        try{sessionStorage.setItem(batchStorageKey,JSON.stringify(ids));sessionStorage.setItem(storageKey,value.taskId)}catch{}
        if(controller.signal.aborted){const cancelled=await deleteJSON<Task>(`${base}/tasks/${value.taskId}`);replaceTask(value.taskId,cancelled);break;}
        while(value.status==='running' && !controller.signal.aborted){
          await new Promise(resolve=>setTimeout(resolve,1500));if(controller.signal.aborted)break;
          value=await getJSON<Task>(`${base}/tasks/${value.taskId}`,{signal:controller.signal});
          setTask(value);setBatchTasks(prev=>prev.map(t=>t.taskId===value.taskId?value:t));
        }
        if(controller.signal.aborted)break;
        if(value.status!=='completed')throw new Error(`Batch ${index+1} did not complete. Remaining batches were not started.`);
        setBatchProgress({done:Math.min((index+1)*10,selected.length),total:selected.length,batch:index+1,count});
      }
    } catch(e){if(!controller.signal.aborted)setError(message(e))}finally{setBatchRunning(false);batchTaskId.current=''}
  }
  async function stopBatch(){
    const id=batchTaskId.current;batchController.current?.abort();
    if(id){try{const value=await deleteJSON<Task>(`${base}/tasks/${id}`);replaceTask(id,value)}catch(e){setError(message(e))}}
  }
  async function applyFields(fields: ReferenceFieldChoice[], selectedTask:Task) {
    const task=selectedTask;
    if (!task || running || task.proposals.some(p=>['applying','uncertain'].includes(p.status))) return;
    setBusy(true); setError("");
    try {
      const value = await postJSON<Task>(`${base}/references/apply`, {body:{taskId:task.taskId,fields}});
      replaceTask(task.taskId,value);
      try { sessionStorage.setItem(storageKey,value.taskId); } catch { /* Session-only fallback. */ }
      setRefresh(value=>value+1);
    } catch (e) {
      const text=message(e);
      setError(text.includes('Bibliography changed') ? 'The bibliography has changed. Check it again before applying.' : text);
    } finally { setBusy(false); }
  }
  async function applyClaim(suggestionId: string, selectedTask:Task) {
    const task=selectedTask;
    if (!task || running || pending) return;
    setBusy(true);setError("");
    try {
      const value=await postJSON<Task>(`${base}/references/claims/apply`,{body:{taskId:task.taskId,suggestionId}});
      replaceTask(task.taskId,value);
      try {sessionStorage.setItem(storageKey,value.taskId)} catch { /* session fallback */ }
    } catch(e) {setError(message(e));} finally {setBusy(false);}
  }
  async function act(selectedTask:Task, proposal?: Proposal, accept?: boolean) {
    const task=selectedTask;
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      replaceTask(task.taskId,
        proposal
          ? await postJSON<Task>(
              `${base}/tasks/${task.taskId}/proposals/${proposal.id}`,
              { body: { accept } },
            )
          : await deleteJSON<Task>(`${base}/tasks/${task.taskId}`),
      );
    } catch (e) {
      setError(message(e));
      setRefresh((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  const current = bibliographies.find((doc) => doc.id === docId);
  return (
    <section
      className="paper-reference-tools"
      aria-label="Reference checks"
    >
          <label htmlFor="reference-check-bibliography">Bibliography</label>
          <div className="paper-literature-input-row">
            <select
              id="reference-check-bibliography"
              value={docId}
              disabled={running}
              onChange={(event) => {
                setDocId(event.target.value);
                setKeys(new Set());
              }}
            >
              {!bibliographies.length && (
                <option value="">No bibliography found</option>
              )}
              {bibliographies.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.path}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={running}
              onClick={() => setRefresh((value) => value + 1)}
              title="Refresh references" aria-label="Refresh references" className="paper-reference-refresh"
            >
              <MaterialIcon type="refresh"/>
            </button>
          </div>
          {current?.error && <p role="alert">{current.error}</p>}
          {!!current?.entries.length && (
            <>
              <div className="paper-reference-check-selection">
                <strong>{keys.size} selected</strong>
                <button
                  type="button"
                  disabled={running}
                  onClick={() =>
                    setKeys(
                      new Set(
                        current.entries.slice(0, 10).map((entry) => entry.key),
                      ),
                    )
                  }
                >
                  Select first 10
                </button>
                <button type="button" disabled={running} onClick={()=>setKeys(new Set(current.entries.map(entry=>entry.key)))}>Select all</button>
                <button
                  type="button"
                  disabled={running || !keys.size}
                  onClick={() => setKeys(new Set())}
                >
                  Clear
                </button>
              </div>
              <div className="paper-reference-check-list">
                {current.entries.map((entry, index) => (
                  <label
                    key={`${entry.key}-${index}`}
                    htmlFor={`reference-check-${index}`}
                    aria-label={entry.title || entry.key}
                  >
                    <input
                      id={`reference-check-${index}`}
                      type="checkbox"
                      checked={keys.has(entry.key)}
                      disabled={running}
                      onChange={(event) =>
                        setKeys((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(entry.key);
                          else next.delete(entry.key);
                          return next;
                        })
                      }
                    />
                    <span>
                      <strong>{entry.title || entry.key}</strong>
                      <code>{entry.key}</code>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="paper-reference-check-actions" role="group" aria-label="Reference check actions">
            <button type="button" className="paper-reference-primary" disabled={running || pending || !keys.size} onClick={() => start("metadata")} title="Check titles, authors, dates and other reference metadata">
              <MaterialIcon type="fact_check"/><span>Check metadata</span>
            </button>
            <button type="button" disabled={running || pending || !keys.size} onClick={() => start("claims")} title="Check whether cited sources support the manuscript claims">
              <MaterialIcon type="find_in_page"/><span>Check citations</span>
            </button>
          </div>
      {busy && <p role="status">Processing references…</p>}
      {batchProgress && <p role="status">{batchProgress.done} / {batchProgress.total} references checked · Batch {batchProgress.batch} / {batchProgress.count}{!batchRunning && batchProgress.done<batchProgress.total?' · Stopped':''}</p>}
      {batchRunning && <button type="button" onClick={stopBatch}>Stop remaining batches</button>}
      {!batchRunning && task?.status === "running" && (
        <button type="button" disabled={busy} onClick={() => task && act(task)}>
          Stop check
        </button>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError("");
              setRefresh((value) => value + 1);
            }}
          >
            Refresh status
          </button>
        </div>
      )}
      {(batchTasks.length?batchTasks:task?[task]:[]).map((result,index)=><div key={result.taskId}>
        {batchTasks.length>0 && <h3>Batch {index+1}</h3>}
        <ReferenceTaskView onRecovered={value=>{setTask(current=>replaceRecoveredTask(current,value));setBatchTasks(current=>current.map(item=>replaceRecoveredTask(item,value)))}} task={result} busy={running} onFields={fields=>applyFields(fields,result)} onClaim={id=>applyClaim(id,result)} onRepair={target=>start('metadata',target)} act={(proposal,accept)=>act(result,proposal,accept)}/>
      </div>)}
    </section>
  );
}
