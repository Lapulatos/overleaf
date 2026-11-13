import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import ShellDrafts from '@/features/source-control/shell-drafts'
import { gitApi, type GitCommand } from '@/features/source-control/api'
import { withSavedEditor } from '@/features/source-control/editor-operation'
import MaterialIcon from '@/shared/components/material-icon'
import '@/features/source-control/source-control.css'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { findEntityByPath, pathInFolder } from '@/features/file-tree/util/path'
import { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorViewContext } from '@/features/ide-react/context/editor-view-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { showAgentEditorReview, clearAgentEditorReview, type EditorReview } from './agent-editor-review'
import "./agent-panel.css";
import { ConversationView } from "./conversation-panel";
import { useProjectContext } from "@/shared/context/project-context";
import { useDetachCompileContext } from "@/shared/context/detach-compile-context";
import { usePermissionsContext } from "@/features/ide-react/context/permissions-context";
export function AssistantDock() {
  const { projectId } = useProjectContext();
  const compile = useDetachCompileContext();
  const permissions = usePermissionsContext();
  const { hasProjectWriteAccess } = useIdeReactContext();
  const { view } = useEditorViewContext();
  const manager = useEditorManagerContext();
  const {fileTreeData}=useFileTreeData();
  const { setShowVisual } = useEditorPropertiesContext();
  const current = useRef({ view, manager, setShowVisual });
  const [activeTab, setActiveTab] = useState<'assistant' | 'terminal'>('assistant');
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [assistantToolbar, setAssistantToolbar] = useState<HTMLDivElement | null>(null);
  const [terminalToolbar, setTerminalToolbar] = useState<HTMLDivElement | null>(null);
  const terminalApi = useMemo(() => {
    const backend = gitApi(projectId);
    return { ...backend, command: (command: GitCommand) => ['shellDraftPrepare', 'shellDraftApply', 'shellDraftRecover'].includes(command.command)
      ? withSavedEditor(manager.openDocs, busy => window.dispatchEvent(new CustomEvent('native-git-local-write-state', { detail: { busy } })), () => backend.command(command))
      : backend.command(command) };
  }, [projectId, manager.openDocs]);
  useEffect(() => { setActiveTab('assistant'); setTerminalMounted(false); }, [projectId]);
  const epoch = useRef(0);
  const [reviewError, setReviewError] = useState('');
  useEffect(() => { current.current = { view, manager, setShowVisual }; }, [view, manager, setShowVisual]);
  useEffect(() => () => {
    epoch.current++;
    if (current.current.view) clearAgentEditorReview(current.current.view);
  }, [projectId]);
  useEffect(() => {
    const locate = (event: Event) => {
      const detail=(event as CustomEvent<{docId:string;text:string}>).detail;
      if(!detail || typeof detail.docId!=='string' || typeof detail.text!=='string' || !detail.text)return;
      const token=++epoch.current;setReviewError('');
      const run=async()=>{
        try {
          current.current.setShowVisual(false);
          if(!await current.current.manager.openDocWithId(detail.docId))throw Error('The cited file is no longer available.');
          for(let i=0;i<60;i++) {
            if(token!==epoch.current)return;
            const {view,manager}=current.current;
            if(view && manager.getCurrentDocumentId()===detail.docId){
              const text=view.state.doc.toString();const from=text.indexOf(detail.text);
              if(from>=0 && text.indexOf(detail.text,from+1)<0){
                clearAgentEditorReview(view);
                view.dispatch({selection:{anchor:from,head:from+detail.text.length},effects:EditorView.scrollIntoView(from,{y:'center'})});view.focus();return;
              }
            }
            await new Promise(resolve=>setTimeout(resolve,50));
          }
          throw Error('The cited sentence changed or is not unique. Check citations again to refresh its location.');
        }catch(error){if(token===epoch.current)setReviewError(error instanceof Error?error.message:'Could not locate the cited sentence.')}
      };run();
    };
    window.addEventListener('reference-locate-citation',locate);
    return ()=>window.removeEventListener('reference-locate-citation',locate);
  },[projectId]);
  useEffect(()=>{
    const open=(event:Event)=>{
      const {path,onError}=(event as CustomEvent<{path:string;onError:(text:string)=>void}>).detail||{};if(typeof path!=='string')return;event.preventDefault();
      const entity=fileTreeData?findEntityByPath(fileTreeData,path):null;
      if(!entity||!fileTreeData||pathInFolder(fileTreeData,entity.entity._id)!==path||entity.type==='folder'){
        const proposal=Array.from(document.querySelectorAll<HTMLElement>('[data-proposal-path]')).find(node=>node.dataset.proposalPath===path);
        if(proposal){for(let parent=proposal.parentElement;parent;parent=parent.parentElement){if(parent.tagName==='DETAILS')(parent as HTMLDetailsElement).open=true}proposal.scrollIntoView({block:'center'});onError?.('This file is not in the project yet. Review its proposed creation below before opening it in the editor.')}
        else onError?.(`File not found in this project: ${path}`)
        return;
      }
      current.current.setShowVisual(false);
      if(entity.type==='doc')current.current.manager.openDocWithId(entity.entity._id).catch(()=>onError?.('Could not open this file. Try again.'));
      else current.current.manager.openFileWithId(entity.entity._id);
    };
    window.addEventListener('paper-open-project-file',open);return()=>window.removeEventListener('paper-open-project-file',open);
  },[fileTreeData]);
  const reviewInEditor = useCallback((review: EditorReview | null) => {
    const token = ++epoch.current;
    if (current.current.view) clearAgentEditorReview(current.current.view);
    setReviewError('');
    if (!review) return;
    const openReview = async () => {
      try {
        const docId = review.proposal.docId;
        if (!docId || !review.isCurrent()) throw new Error('This suggestion is no longer available.');
        current.current.setShowVisual(false);
        const doc = await current.current.manager.openDocWithId(docId);
        if (!doc) throw new Error('The proposed file is no longer in this project.');
        // Opening a file and attaching its CodeMirror state finish separately.
        for (let attempt = 0; attempt < 40; attempt++) {
          if (token !== epoch.current || !review.isCurrent()) return;
          const { view, manager } = current.current;
          if (view && manager.getCurrentDocumentId() === docId && view.state.doc.toString() === review.proposal.before) {
            showAgentEditorReview(view, {
              ...review,
              isCurrent: () => token === epoch.current && review.isCurrent() && current.current.manager.getCurrentDocumentId() === docId,
            }); return;
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error('The document changed or is still loading. Check it before reviewing this suggestion.');
      } catch (error) {
        if (token === epoch.current) setReviewError(error instanceof Error ? error.message : 'Could not open source review.');
      }
    };
    openReview();
  }, []);
  if (!(hasProjectWriteAccess ?? permissions.write)) return null;
  return (
    <section className="paper-assistant-dock" aria-label="Paper Assistant">
      <header className="paper-workspace-tabs-header">
        <div role="tablist" aria-label="Assistant and terminal">
          <button type="button" role="tab" aria-selected={activeTab === 'assistant'} onClick={() => setActiveTab('assistant')}>Paper Assistant</button>
          <button type="button" role="tab" aria-selected={activeTab === 'terminal'} onClick={() => { setTerminalMounted(true); setActiveTab('terminal'); }}><MaterialIcon type="terminal" />Terminal</button>
        </div>
        <div className="paper-workspace-tab-actions" ref={setAssistantToolbar} hidden={activeTab !== 'assistant'} />
        <div className="paper-workspace-tab-actions" ref={setTerminalToolbar} hidden={activeTab !== 'terminal'} />
      </header>
      <div className="paper-workspace-tab-content" role="tabpanel" aria-label="Paper Assistant" hidden={activeTab !== 'assistant'}>
      {reviewError && <p role="alert">{reviewError}</p>}
      <ConversationView
        key={projectId}
        projectId={projectId}
        dock
        toolbarTarget={assistantToolbar}
        getSourceSelection={() => {
          const { view, manager } = current.current;
          if (!view || view.state.selection.main.empty) return undefined;
          const { from, to } = view.state.selection.main;
          return { docId: manager.getCurrentDocumentId(), from, to, text: view.state.doc.sliceString(from, to) };
        }}
        onReviewInEditor={reviewInEditor}
        diagnostics={{
          errors: compile.logEntries?.errors,
          rawLog: compile.rawLog,
          error: compile.error,
          hasChanges: compile.hasChanges,
          compiling: compile.compiling,
        }}
      />
      </div>
      {terminalMounted && <div className="paper-workspace-tab-content paper-terminal-tab" role="tabpanel" aria-label="Terminal" hidden={activeTab !== 'terminal'}><ShellDrafts key={projectId} api={terminalApi} embedded autoStart canApply active={activeTab === 'terminal'} toolbarTarget={terminalToolbar} onClose={() => { setActiveTab('assistant'); setTerminalMounted(false); }} /></div>}
    </section>
  );
}
