import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context';
import { SubmissionWorkspace } from "@/features/plugins/submission-workspace";
import { EditorLoadingPane } from "@/features/ide-react/components/editor/editor-loading-pane";
import { useEditorOpenDocContext } from "@/features/ide-react/context/editor-open-doc-context";
import { useFileTreeOpenContext } from "@/features/ide-react/context/file-tree-open-context";
import classNames from "classnames";
import SourceEditor from "@/features/source-editor/components/source-editor";
import { Panel, PanelGroup, type ImperativePanelHandle } from "react-resizable-panels";
import { VerticalResizeHandle } from "@/features/ide-react/components/resize/vertical-resize-handle";
import { Suspense, useEffect, useRef, useState } from "react";
import { FullSizeLoadingSpinner } from "@/shared/components/loading-spinner";
import SymbolPalettePane from "@/features/ide-react/components/editor/symbol-palette-pane";
import { useEditorPropertiesContext } from "@/features/ide-react/context/editor-properties-context";
import { PythonEditorSplit } from "@/features/ide-react/components/layout/python-editor-split";
import { isSplitTestEnabled } from "@/utils/splitTestUtils";
import { usePermissionsContext } from "@/features/ide-react/context/permissions-context";
import { AssistantDock } from "@/features/source-editor/extensions/writing-assist/assistant-dock";

export const Editor = () => {
  const assistantPanel=useRef<ImperativePanelHandle>(null);
  useEffect(()=>{const expand=()=>assistantPanel.current?.resize(65);window.addEventListener('runtime-terminal-dock',expand);return()=>window.removeEventListener('runtime-terminal-dock',expand)},[]);
  const permissions = usePermissionsContext();
  const { hasProjectWriteAccess } = useIdeReactContext();
  const editorContainer = useRef<HTMLDivElement>(null);
  const [assistantMinSize, setAssistantMinSize] = useState(20);
  const { opening, errorState, showSymbolPalette } =
    useEditorPropertiesContext();
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext();
  const { currentDocumentId, currentDocument } = useEditorOpenDocContext();
  const isPythonDocument =
    openEntity?.type === "doc" &&
    openEntity.entity.name.toLowerCase().endsWith(".py");
  const pythonExecutionEnabled = isSplitTestEnabled("overleaf-code");

  useEffect(() => {
    const element = editorContainer.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (height > 0) setAssistantMinSize(Math.min(60, Math.max(20, 100 * (width < 500 ? 200 : 160) / height)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [currentDocumentId]);

  if (!currentDocumentId) {
    return null;
  }

  const isLoading = Boolean(
    (!currentDocument || opening) && !errorState && currentDocumentId,
  );

  return (
    <div
      ref={editorContainer}
      className={classNames(
        "ide-redesign-editor-content paper-editor-with-assistant",
        {
          hidden: openEntity?.type !== "doc" || selectedEntityCount !== 1,
        },
      )}
    >
      <PanelGroup
        autoSaveId="paper-editor-assistant-height"
        direction="vertical"
      >
        <Panel id="paper-editor-main" order={1} defaultSize={70} minSize={25}>
          <PanelGroup
            autoSaveId="ide-redesign-editor-symbol-palette"
            direction="vertical"
          >
            <Panel
              id="ide-redesign-panel-source-editor"
              order={1}
              className="ide-redesign-editor-panel"
            >
              <SubmissionWorkspace>
              {isPythonDocument && pythonExecutionEnabled ? (
                <PythonEditorSplit />
              ) : (
                <SourceEditor />
              )}
              {isLoading && <EditorLoadingPane />}
              </SubmissionWorkspace>
            </Panel>
            {showSymbolPalette && (
              <>
                <VerticalResizeHandle id="ide-redesign-editor-symbol-palette" />
                <Panel
                  id="ide-redesign-panel-symbol-palette"
                  order={2}
                  defaultSize={25}
                  minSize={10}
                  maxSize={50}
                >
                  <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
                    <SymbolPalettePane />
                  </Suspense>
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
        {(hasProjectWriteAccess ?? permissions.write) && (
          <>
            <VerticalResizeHandle
              id="paper-assistant-resize"
              className="paper-assistant-resize"
              aria-label="Resize Paper Assistant"
            />
            <Panel
              id="paper-editor-assistant"
              ref={assistantPanel}
              order={2}
              defaultSize={30}
              minSize={assistantMinSize}
              maxSize={75}
              className="paper-assistant-panel"
            >
              <AssistantDock />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
};
