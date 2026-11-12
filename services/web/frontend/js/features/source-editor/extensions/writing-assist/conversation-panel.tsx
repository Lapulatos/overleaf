import { replaceRecoveredTask } from './recovered-task'
import { useGitCommand } from '@/features/source-control/git-command-panel'
import AccessMode from '@/features/source-control/access-mode'
import {usePlanCommand} from '@/features/plugins/plan-command'
import {IssueReplyContext} from './issue-clarification'
import { ComposerContext, type ScopeItem } from './composer-context';
import { readComposerImage } from './composer-image';
import { GoalPanel, GoalTimer, type GoalResult } from './goal-panel';
import { MessageCopyButton, MessageAvatar, UserMessage, AssistantMessage, AgentActivity, type Activity, type SourceSelection } from './agent-messages';
import { useEffect, useState, useRef } from "react";
import MaterialIcon from "@/shared/components/material-icon";
import { ModelControls, type ModelSelection } from "./model-controls";
import { PaperVoiceInput } from "./local-voice-input";
import { type ImageAttachment } from "./image-attachment";
import {
  compileErrorInstruction,
  type CompileDiagnostics,
} from "./compile-diagnostics";
import {
  getJSON,
  postJSON,
  deleteJSON,
  FetchError,
} from "@/infrastructure/fetch-json";
import OLButton from "@/shared/components/ol/ol-button";
import {
  AgentTaskResult,
  message,
  type Task,
  type Proposal,
} from "./agent-task-result";

import type { EditorReview } from "./agent-editor-review";

type Turn = {
  inherited?: boolean;
  createdAt?: string;
  scope?: ScopeItem[];
  plugins?: {command:string}[];
  taskId: string;
  instruction: string;
  summary: string;
  activity?: Activity[];
  sourceSelection?: SourceSelection;
  status: string;
  proposals: { path: string; status: string }[];
  attachments?: { name: string; width: number; height: number }[];
};
type Conversation = {
  id: string;
  title: string;
  activeTaskId: string | null;
  parent?: {conversationId:string;taskId:string;edge:string};
  turns: Turn[];
};
type Result = { conversation: Conversation; task: Task | null; draft?: {instruction:string;scope:ScopeItem[];skills:string[]}; notice?:string };

export function ConversationView({
  projectId,
  diagnostics,
  dock = false,
  onReviewInEditor,
  getSourceSelection,
}: {
  projectId: string;
  diagnostics?: CompileDiagnostics;
  dock?: boolean;
  getSourceSelection?: () => { docId: string | null | undefined; from: number; to: number; text: string } | undefined;
  onReviewInEditor?: (review: EditorReview | null) => void;
}) {
  const planCommand=usePlanCommand(projectId);
  const gitCommand=useGitCommand(projectId);
  const base = `/writing-assist/project/${encodeURIComponent(projectId)}/conversations`;
  const [list, setList] = useState<Conversation[]>([]);
  const [id, setId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [instruction, setInstruction] = useState("");
  useEffect(()=>{
    const insert=(event:Event)=>{const detail=(event as CustomEvent<{command:string;input?:string;replace?:boolean}>).detail;const command=detail?.command;if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(command || ''))return;setInstruction(previous=>`/${command} ${detail.input ? detail.input+'\n\n' : ''}${detail.replace?'':previous.replace(/^\/[a-z0-9-]+\s*/, '')}`);document.getElementById('paper-assistant-instruction')?.focus()};
    window.addEventListener('paper-plugin-command',insert);return()=>window.removeEventListener('paper-plugin-command',insert);
  },[]);

  const [scope,setScope]=useState<ScopeItem[]>([]);
  const [skills,setSkills]=useState<string[]>([]);
  const [caret,setCaret]=useState(0);
  const goalCommand=instruction.trim().match(/^\/(resume|stop|pause)\s+goal$/i)?.[1]?.toLowerCase();
  const replaceGoal=/^\/goal(?:\s|$)/i.test(instruction);
  const [goalInfo,setGoalInfo]=useState<GoalResult['goal']>(null);
  const [goalMinutes,setGoalMinutes]=useState('');
  const transcript=useRef<HTMLDivElement>(null);
  const followLatest=useRef(true);
  const [following,setFollowing]=useState(true);
  function jumpToLatest(){followLatest.current=true;setFollowing(true);const node=transcript.current;if(node)node.scrollTop=node.scrollHeight;}
  useEffect(()=>{
    const node=transcript.current;if(!node)return;
    followLatest.current=true;setFollowing(true);
    let frame=0;
    const scroll=()=>{const nearBottom=node.scrollHeight-node.clientHeight-node.scrollTop<40;followLatest.current=nearBottom;setFollowing(nearBottom)};
    const wheel=(event:WheelEvent)=>{if(event.deltaY<0){followLatest.current=false;setFollowing(false)}};
    const update=()=>{if(followLatest.current){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(followLatest.current)node.scrollTop=node.scrollHeight})}};
    const observer=new MutationObserver(update);observer.observe(node,{childList:true,subtree:true,characterData:true});node.addEventListener('scroll',scroll);node.addEventListener('wheel',wheel,{passive:true});update();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);node.removeEventListener('scroll',scroll);node.removeEventListener('wheel',wheel)};
  },[id]);
  const goalMode=/^\/goal(?:\s|$)/i.test(instruction);
  const goalObjective=instruction.replace(/^\/goal(?:\s+|$)/i,'').trim();
  const [goalActive,setGoalActive]=useState(false);
  const [reviewMode,setReviewMode]=useState<'human'|'ai'>('human');
  const imageInput=useRef<HTMLInputElement>(null);
  const imageSequence=useRef(0);
  const textarea=useRef<HTMLTextAreaElement>(null);
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const branchLock=useRef(false);
  const branchRequests=useRef(new Map<string,string>());
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<ModelSelection>({});
  const [expanded, setExpanded] = useState(false);
  const [tool, setTool] = useState<"voice" | null>(null);
  const currentResult = useRef(result);
  const editorReview = useRef<EditorReview | null>(null);
  useEffect(() => {
    currentResult.current = result;
    if (editorReview.current && !editorReview.current.isCurrent()) {
      editorReview.current = null;
      onReviewInEditor?.(null);
    }
  }, [result, onReviewInEditor]);
  useEffect(() => () => onReviewInEditor?.(null), [id, onReviewInEditor]);
  const running = Boolean(result?.conversation.activeTaskId) || goalActive;
  const sendBlocked=running&&!goalCommand&&!(replaceGoal&&goalActive&&!result?.conversation.activeTaskId);
  useEffect(() => {
    if (!tool) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setTool(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [tool]);

  useEffect(() => {
    const controller = new AbortController();
    getJSON<Conversation[]>(base, { signal: controller.signal })
      .then((values) => {
        if (controller.signal.aborted || !values) return;
        setList(values);
        setId((current) => current || values[0]?.id || "");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error));
      });
    return () => controller.abort();
  }, [base, refresh]);

  useEffect(() => {
    if (!id || busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    let pollingFailed = false;
    async function poll() {
      try {
        const value = await getJSON<Result>(`${base}/${id}`, {
          signal: controller.signal,
        });
        if (!value || controller.signal.aborted) return;
        setResult(value);
        if (pollingFailed) setError("");
        pollingFailed = false;
        retryCount = 0;
        if (value.conversation.activeTaskId) timer = setTimeout(poll, 1000);
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(message(error));
        pollingFailed = true;
        const status =
          error instanceof FetchError ? error.response?.status : undefined;
        if (
          (status === undefined || [502, 503, 504].includes(status)) &&
          retryCount < 5
        ) {
          timer = setTimeout(poll, Math.min(1000 * 2 ** retryCount++, 8000));
        }
      }
    }
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [base, id, busy, refresh]);

  async function attachImage(file?:File){
    if(!file||busy||running)return;
    const sequence=++imageSequence.current;setImageLoading(true);setError('');
    try{const image=await readComposerImage(file);if(sequence===imageSequence.current)setAttachment(image)}catch(e){if(sequence===imageSequence.current)setError(message(e))}finally{if(sequence===imageSequence.current)setImageLoading(false)}
  }
  const issueReplyLock=useRef(false);
  async function replyToIssue(instruction:string){
    if(issueReplyLock.current||busy||running||!id)throw new Error('Wait for the current task to finish before responding.');
    issueReplyLock.current=true;setBusy(true);setError('');
    try{const value=await postJSON<Result>(`${base}/${id}/messages`,{body:{instruction,...selection}});setResult(value);setExpanded(true);jumpToLatest()}
    finally{issueReplyLock.current=false;setBusy(false)}
  }
  async function submit() {
    if (!instruction.trim() || (goalMode&&!goalObjective) || busy || gitCommand.busy || sendBlocked || imageLoading) return;
    setBusy(true);
    setExpanded(true);
    jumpToLatest();
    setError("");
    let conversationId = id;
    try {
      if(/^\/git(?:\s|$)/i.test(instruction.trim())){await gitCommand.start(instruction);setInstruction('');return}
      if(/^\/plan(?:\s|$)/i.test(instruction.trim())){await planCommand.start(instruction);setInstruction('');setAttachment(null);return}
      if(goalCommand&&!conversationId)throw new Error('No goal exists in this conversation yet. Use /goal followed by an objective.');
      if (!conversationId) {
        const conversation = await postJSON<Conversation>(base, {
          body: { title: instruction.trim().slice(0, 160) },
        });
        conversationId = conversation.id;
        setId(conversation.id);
        setList((values) => [conversation, ...values]);
      }
      if(goalCommand){
        await postJSON(`${base}/${conversationId}/goal/action`,{body:{action:goalCommand}});
        setInstruction('');setGoalActive(goalCommand==='resume');window.dispatchEvent(new Event('paper-goal-changed'));setRefresh(n=>n+1);return;
      }
      if(goalMode){
        await postJSON(`${base}/${conversationId}/goal`,{body:{objective:goalObjective,replaceExisting:replaceGoal,reviewMode,scope,skills,...(goalMinutes?{timeLimitMinutes:Number(goalMinutes)}:{}),...selection,...(attachment?{images:[{name:attachment.name,mime:attachment.mime,data:attachment.data}]}:{})}});
        setInstruction('');setAttachment(null);setGoalActive(true);window.dispatchEvent(new Event('paper-goal-changed'));setRefresh(n=>n+1);return;
      }
      const value = await postJSON<Result>(
        `${base}/${conversationId}/messages`,
        {
          body: {
            instruction: instruction.trim(),
            scope,skills,
            sourceSelection: getSourceSelection?.(),
            ...selection,
            ...(attachment
              ? {
                  images: [
                    {
                      name: attachment.name,
                      mime: attachment.mime,
                      data: attachment.data,
                    },
                  ],
                }
              : {}),
          },
        },
      );
      setResult(value);
      setInstruction("");
      setAttachment(null);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function branchTurn(taskId:string,action:'retry'|'user'|'assistant') {
    if(branchLock.current||busy)return;
    branchLock.current=true;setBusy(true);setError('');setExpanded(true);
    const key=`${id}:${taskId}:${action}`;
    const requestId=branchRequests.current.get(key)||crypto.randomUUID();branchRequests.current.set(key,requestId);
    try{
      const value=await postJSON<Result>(`${base}/${id}/tasks/${taskId}/${action==='retry'?'retry':'branch'}`,{body:{requestId,...(action==='retry'?{}:{edge:action})}});
      setId(value.conversation.id);setResult(value);setList(values=>[value.conversation,...values.filter(c=>c.id!==value.conversation.id)]);
      setInstruction(value.draft?.instruction||'');setScope(value.draft?.scope||[]);setSkills(value.draft?.skills||[]);setAttachment(null);setGoalActive(false);setGoalInfo(null);setError(value.notice||'');
      branchRequests.current.delete(key);jumpToLatest();textarea.current?.focus();
    }catch(e){setError(message(e))}finally{branchLock.current=false;setBusy(false)}
  }
  function turnActions(turn:{taskId:string;status:string;summary:string}){
    return <div className="paper-turn-actions" role="group" aria-label="Message actions">
      <MessageCopyButton text={turn.summary} label="Copy assistant message" />
      {['failed','timeout','cancelled'].includes(turn.status)&&<button type="button" aria-label="Retry request" title="Retry request" disabled={busy||running} onClick={()=>branchTurn(turn.taskId,'retry')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6M20 7l-3-3"/></svg></button>}
      <details className="paper-branch-menu" onToggle={event=>{const node=event.currentTarget;if(!node.open)return;const rect=node.getBoundingClientRect();const menu=node.querySelector<HTMLElement>('.paper-branch-menu-options');if(menu){menu.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-200))}px`;menu.style.top=`${Math.max(8,rect.top-90)}px`}}}><summary aria-label="Branch conversation" title="Branch conversation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M18 7c0 7-12 3-12 8"/></svg></summary><div className="paper-branch-menu-options">
      <button type="button" disabled={busy} onClick={()=>branchTurn(turn.taskId,'user')}>Branch from request</button>
      <button type="button" disabled={busy||!['completed','failed','timeout','cancelled'].includes(turn.status)} onClick={()=>branchTurn(turn.taskId,'assistant')}>Branch from reply</button>
      </div></details>
    </div>;
  }

  async function act(proposal?: Proposal, accept?: boolean) {
    const taskId = proposal
      ? result?.task?.taskId
      : result?.conversation.activeTaskId;
    if (!taskId) return false;
    setBusy(true);
    setError("");
    try {
      const path = `${base}/${id}/tasks/${taskId}`;
      setResult(
        proposal
          ? await postJSON<Result>(`${path}/proposals/${proposal.id}`, {
              body: { accept },
            })
          : await deleteJSON<Result>(path),
      );
      return true;
    } catch (error) {
      setError(message(error));
      if (proposal) {
        // The write may have succeeded despite a lost response. Read its state
        // once; never automatically repeat a mutation after a network failure.
        try {
          const latest = await getJSON<Task>(`/writing-assist/project/${encodeURIComponent(projectId)}/tasks/${taskId}`);
          if (latest) {
            setResult((current) => current && { ...current, task: latest });
            const reviewed = latest.proposals.find(item => item.id === proposal.id);
            if (reviewed?.status === (accept ? "accepted" : "rejected")) {
              setError("");
              return true;
            }
          }
        } catch {
          // Keep the original error and the last known state when offline.
        }
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  function reviewInEditor(proposal: Proposal) {
    const taskId = result?.task?.taskId;
    const review: EditorReview = {
      proposal,
      decide: (accept) => act(proposal, accept),
      isCurrent: () => {
        const current = currentResult.current?.task;
        return Boolean(current && current.taskId === taskId && current.proposals.some(item => item.id === proposal.id && item.status === "pending"));
      },
    };
    editorReview.current = review;
    onReviewInEditor?.(review);
  }

  async function reviewTurn(taskId: string) {
    setError("");
    try {
      const task = await getJSON<Task>(
        `/writing-assist/project/${encodeURIComponent(projectId)}/tasks/${taskId}`,
      );
      if (task) setResult((current) => current && { ...current, task });
    } catch (error) {
      setError(message(error));
    }
  }

  const latestTurn = result?.conversation.turns.at(-1);
  const ordinaryTaskLatest = Boolean(result?.conversation.activeTaskId) || (!goalActive && Boolean(latestTurn?.createdAt && goalInfo && Date.parse(latestTurn.createdAt) > Date.parse(goalInfo.updatedAt || goalInfo.createdAt || '')));
  const goalPanel = <GoalPanel key="goal" projectId={projectId} conversationId={id} onState={setGoalActive} onGoal={setGoalInfo}/>;
  const currentTask = result?.task ? <div key="current-task"><AgentTaskResult onRecovered={value=>setResult(current=>current?{...current,task:replaceRecoveredTask(current.task,value)}:current)} task={result.task} busy={busy} act={act} onReviewInEditor={onReviewInEditor ? reviewInEditor : undefined} messageActions={turnActions(result.task)} /></div> : null;
  const latestActivity = result?.task?.activity?.at(-1);
  return (
    <IssueReplyContext.Provider value={{key:`${projectId}:${id}`,disabled:busy||running||!id,submit:replyToIssue}}>
    <div className="paper-assistant-view">
      {gitCommand.panel}
      {dock && (
        <div className="paper-dock-heading">
          <strong>Paper Assistant</strong>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide conversation" : "Conversation & changes"}
            {running || planCommand.running ? " · Working" : ""}
          </button>
        </div>
      )}
      <div ref={transcript} className="paper-conversation-content" hidden={dock && !expanded}>
        <p className="paper-assistant-intro" hidden={Boolean(result)}>
          Write, revise, and explore ideas with your paper in context.
        </p>
        <div className="paper-conversation-picker">
        <label htmlFor="assistant-conversation">Conversation</label>
        <select
          id="assistant-conversation"
          className="form-control"
          value={id}
          disabled={busy}
          onChange={(event) => {
            if (event.target.value === id) return;
            setId(event.target.value);
            setResult(null);
            setError("");
            setInstruction("");
            setAttachment(null);
            setImageLoading(false);
            imageSequence.current++;setScope([]);setSkills([]);setGoalActive(false);
          }}
        >
          <option value="">New conversation</option>
          {list.map((item) => (
            <option key={item.id} value={item.id}>
              {item.parent ? `↳ ${item.title} · ${item.id.slice(0,6)}` : item.title}
            </option>
          ))}
        </select>
        </div>
        {result?.conversation.parent&&<div className="paper-branch-notice"><span>Branched conversation · uses the current manuscript files.</span><button type="button" disabled={busy} onClick={()=>{setId(result.conversation.parent!.conversationId);setResult(null);setInstruction('');setScope([]);setSkills([]);setAttachment(null);setGoalActive(false);setGoalInfo(null)}}>Back to parent conversation</button></div>}
        <div role="log" aria-label="Conversation history">
          {result?.conversation.turns
            .filter((turn) => turn.taskId !== result.task?.taskId)
            .map((turn) => (
              <article
                key={turn.taskId}
                className="paper-history-turn"
              >
                <UserMessage instruction={turn.instruction} sourceSelection={turn.sourceSelection} />
                {!!turn.scope?.length&&<p className="paper-context-scope">Edit scope: {turn.scope.map(s=>s.path).join(', ')}</p>}
                {!!turn.plugins?.length&&<p className="paper-context-scope">Skills: {turn.plugins.map(s=>s.command).join(', ')}</p>}
                <div className="paper-assistant-bubble"><div className="paper-reply-header"><MessageAvatar assistant /><span className="paper-task-status">Status: {turn.status}</span></div>
                {turn.attachments?.map((image) => (
                  <p key={image.name}>
                    Image: {image.name} ({image.width} × {image.height})
                  </p>
                ))}
                <AgentActivity activity={turn.activity} />
                {!turn.activity?.some(item=>item.kind==='message'&&item.text?.trim()===turn.summary.trim())&&<AssistantMessage text={turn.summary} compact />}
                {turnActions(turn)}
                </div>
                {!turn.inherited&&turn.proposals.some(
                  (proposal) => proposal.status === "pending",
                ) && (
                  <OLButton
                    disabled={busy || running}
                    onClick={() => reviewTurn(turn.taskId)}
                  >
                    Review this reply
                  </OLButton>
                )}
                {turn.proposals.map((proposal, index) => (
                  <p key={index}>
                    {proposal.path}: {proposal.status}
                  </p>
                ))}
              </article>
            ))}
        </div>
        {planCommand.panel}
        {ordinaryTaskLatest ? [goalPanel, currentTask] : [currentTask, goalPanel]}
        {diagnostics &&
          Boolean(diagnostics.errors?.length || diagnostics.error) && (
            <div style={{ marginTop: 12 }}>
              <OLButton
                disabled={
                  busy ||
                  running ||
                  diagnostics.compiling ||
                  Boolean(instruction.trim()) ||
                  (!diagnostics.errors?.length && !diagnostics.error)
                }
                onClick={() =>
                  setInstruction(compileErrorInstruction(diagnostics))
                }
              >
                Explain compile errors
              </OLButton>
              {diagnostics.hasChanges &&
                Boolean(diagnostics.errors?.length || diagnostics.error) && (
                  <p>
                    The project changed after the last compilation. Recompile
                    for current diagnostics, or review the older errors with the
                    assistant.
                  </p>
                )}
              {Boolean(instruction.trim()) && (
                <p>
                  Clear your draft before preparing a compile-error request.
                </p>
              )}
            </div>
          )}
      </div>
      {!following&&expanded&&<button type="button" className="paper-jump-latest" onClick={jumpToLatest}>↓ Jump to latest</button>}
      <div
        onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}}
        onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();attachImage(e.dataTransfer.files[0])}}}
        className="paper-composer"
        role="group"
        aria-label="Message composer"
      >
        <label
          htmlFor="paper-assistant-instruction"
          className={dock ? "paper-input-label" : undefined}
        >
          Instructions
        </label>
        <ComposerContext projectId={projectId} value={instruction} caret={caret} scope={scope} skills={skills} onScope={setScope} onSkills={setSkills} disabled={busy||running} onReplace={(value,position)=>{setInstruction(value);setCaret(position);requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.setSelectionRange(position,position)})}}/>
        {goalMode&&<div className="paper-goal-mode"><span>Goal</span><label htmlFor="paper-goal-review-mode">Review mode</label><select id="paper-goal-review-mode" value={reviewMode} onChange={e=>setReviewMode(e.target.value as 'human'|'ai')}><option value="human">Manual approval</option><option value="ai">Automatic · AI review</option></select><label htmlFor="paper-goal-time-limit">Time limit</label><input id="paper-goal-time-limit" type="number" min="1" max="1440" placeholder="No limit" value={goalMinutes} onChange={e=>setGoalMinutes(e.target.value)}/><span>min</span></div>}
        {attachment&&<div className="paper-image-chip"><img src={`data:${attachment.mime};base64,${attachment.data}`} alt={`Attached image: ${attachment.name}`}/><span>{attachment.name}</span><button type="button" aria-label="Remove image" disabled={busy||running} onClick={()=>{imageSequence.current++;setAttachment(null);setImageLoading(false)}}>×</button></div>}
        <input ref={imageInput} type="file" accept="image/png,image/jpeg" hidden aria-label="Upload image file" onChange={e=>{attachImage(e.target.files?.[0]);e.target.value=''}}/>
        <textarea
          ref={textarea}
          id="paper-assistant-instruction"
          className="form-control"
          rows={dock ? 2 : 4}
          maxLength={32000}
          value={instruction}
          disabled={busy || Boolean(id && !result)}
          onChange={(event) => {setInstruction(event.target.value);setCaret(event.target.selectionStart)}}
          onSelect={event=>setCaret(event.currentTarget.selectionStart)}
          onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&!document.querySelector('.paper-context-picker [role="option"]')){event.preventDefault();submit()}}}
          onPaste={event=>{const file=Array.from(event.clipboardData.files).find(f=>f.type.startsWith('image/'));if(file){event.preventDefault();attachImage(file)}}}
          placeholder="Ask anything · @ files · / Skills · /goal your objective"
        />
        <div className="paper-composer-toolbar">
          <div className="paper-composer-actions">
            <button type="button" className="paper-composer-icon" title="Mention files or folders" aria-label="Mention files or folders" disabled={busy||running} onClick={()=>{const value=instruction+(instruction&&!instruction.endsWith(' ')?' ':'')+'@';setInstruction(value);setCaret(value.length);textarea.current?.focus()}}>@</button>
            <button type="button" className="paper-composer-icon" title="Skills and commands" aria-label="Skills and commands" disabled={busy||running} onClick={()=>{const value=instruction+(instruction&&!instruction.endsWith(' ')?' ':'')+'/';setInstruction(value);setCaret(value.length);textarea.current?.focus()}}>/</button>

            <button
              type="button"
              className="paper-composer-icon"
              title="Attach image"
              aria-label="Attach image"
              disabled={busy || running}
              onClick={() => imageInput.current?.click()}
            >
              <MaterialIcon type="add" />
              {attachment && <span className="paper-attachment-dot" />}
            </button>
            <button
              type="button"
              className="paper-composer-icon"
              title="Voice input"
              aria-label="Voice input"
              aria-expanded={tool === "voice"}
              aria-controls="paper-composer-voice"
              disabled={busy || running}
              onClick={() => setTool(tool === "voice" ? null : "voice")}
            >
              <MaterialIcon type="mic" />
            </button>
            <AccessMode projectId={projectId} disabled={busy} />
          </div>
          <div className="paper-assistant-send">
            {dock && (
              <ModelControls
                projectId={projectId}
                compact
                disabled={busy || running}
                onChange={setSelection}
              />
            )}
            <OLButton
              variant="primary"
              className="paper-composer-submit"
              aria-label={goalMode?"Start goal":"Send message"}
              disabled={
                busy ||
                imageLoading ||
                sendBlocked ||
                !instruction.trim() ||
                (goalMode && !goalObjective) ||
                Boolean(id && !result)
              }
              onClick={submit}
            >
              <MaterialIcon type="arrow_upward" />
            </OLButton>
            {result?.conversation.activeTaskId && (
              <OLButton disabled={busy} onClick={() => act()}>
                Cancel task
              </OLButton>
            )}
          </div>
        </div>
        <div
          id="paper-composer-voice"
          className="paper-composer-panel"
          hidden={tool !== "voice"}
        >
          <PaperVoiceInput
            projectId={projectId}
            key={`${projectId}/${id}`}
            disabled={busy || Boolean(id && !result)}
            onInsert={(text) => {
              const combined = [instruction, text].filter(Boolean).join("\n");
              if (combined.length > 32000) return false;
              setInstruction(combined);
              return true;
            }}
          />
        </div>
      </div>
      {result?.conversation.activeTaskId ? <div className="paper-current-task-status" role="status" aria-label="Current task progress">
        <strong>Working</strong><span>{result.task?.scope?.map(item=>item.path).join(', ') || 'Current request'}</span>
        <span>{latestActivity ? `${result.task?.activity?.length || 0} actions · ${latestActivity.title} · ${latestActivity.status}` : 'Preparing task · waiting for the first update…'}</span>
        {!following&&<button type="button" onClick={jumpToLatest}>View live progress</button>}
      </div> : !ordinaryTaskLatest&&<GoalTimer goal={goalInfo}/>}
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
            Refresh conversation
          </OLButton>
        </div>
      )}
    </div>
    </IssueReplyContext.Provider>
  );
}
