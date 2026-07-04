import { forwardRef, useImperativeHandle } from "react";
import type { WorkSnapshot, WorkspaceEntry } from "@/lib/story";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { WorkspaceFilesHeader } from "@/features/app-chrome";
import { useWorkspaceFiles } from "@/hooks/workspace/use-workspace-files";
import { useFileTreePanelCollapse } from "@/hooks/layout/use-file-tree-collapse";
import { WorkspaceFileEditor, type WorkspaceFileTab } from "@/features/workspace-file-editor";
import { WorkspaceFileTree } from "@/features/workspace-file-tree";
import {
  DEFAULT_WORKSPACE_FILES_LAYOUT,
  PANEL_LAYOUT_IDS,
  PANEL_MAX_PX,
  PANEL_MIN_PX,
  panelPct,
  panelPx,
  readPanelLayout,
  savePanelLayout,
} from "@/lib/panel-layout";

export type WorkspaceFilesHandle = {
  closeCurrentOrApp: () => void;
  openFile: (path: string) => void;
};

type WorkWorkspacePanelProps = {
  work: WorkSnapshot | null;
  refreshKey: string;
  onWorkUpdated?: (work: WorkSnapshot) => void;
};

export const WorkWorkspacePanel = forwardRef<WorkspaceFilesHandle, WorkWorkspacePanelProps>(
  function WorkWorkspacePanel({ work, refreshKey, onWorkUpdated }, ref) {
    const files = useWorkspaceFiles({ work, refreshKey, onWorkUpdated });

    useImperativeHandle(
      ref,
      () => ({
        closeCurrentOrApp: files.closeCurrentOrApp,
        openFile: files.selectFile,
      }),
      [files.closeCurrentOrApp, files.selectFile],
    );

    if (!work) {
      return (
        <div className="surface-sidebar flex h-full items-center justify-center px-6 py-12 text-center text-xs leading-relaxed text-muted-foreground">
          选择工作空间后，工作区文件将显示在这里
        </div>
      );
    }

    return (
      <div className="surface-sidebar flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <WorkspaceFilesLayout
          entries={files.entries}
          openTabs={files.openTabs}
          selectedPath={files.selectedPath}
          workPath={work.workPath}
          fileContent={files.fileContent}
          savedContent={files.savedContent}
          loadingFile={files.loadingFile}
          saving={files.saving}
          readable={files.readable}
          onSelectFile={files.selectFile}
          onSelectTab={files.selectTab}
          onCloseTab={files.closeTab}
          onMutated={files.handleWorkspaceMutated}
          onChange={files.setFileContent}
          onSave={() => void files.handleSave()}
        />
      </div>
    );
  },
);

type WorkspaceFilesLayoutProps = {
  entries: WorkspaceEntry[];
  openTabs: WorkspaceFileTab[];
  selectedPath: string | null;
  workPath: string;
  fileContent: string;
  savedContent: string;
  loadingFile: boolean;
  saving: boolean;
  readable: boolean;
  onSelectFile: (path: string) => void;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onMutated: () => Promise<void>;
  onChange: (value: string) => void;
  onSave: () => void;
};

function WorkspaceFilesLayout({
  entries,
  openTabs,
  selectedPath,
  workPath,
  fileContent,
  savedContent,
  loadingFile,
  saving,
  readable,
  onSelectFile,
  onSelectTab,
  onCloseTab,
  onMutated,
  onChange,
  onSave,
}: WorkspaceFilesLayoutProps) {
  const fileTreePanel = useFileTreePanelCollapse();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <WorkspaceFilesHeader
        fileTreeCollapsed={fileTreePanel.fileTreeCollapsed}
        onToggleFileTree={fileTreePanel.toggleFileTreePanel}
      />
      <ResizablePanelGroup
        id={PANEL_LAYOUT_IDS.workspaceFiles}
        groupRef={fileTreePanel.filesGroupRef}
        direction="horizontal"
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        defaultLayout={
          readPanelLayout(PANEL_LAYOUT_IDS.workspaceFiles) ??
          DEFAULT_WORKSPACE_FILES_LAYOUT
        }
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) {
            savePanelLayout(PANEL_LAYOUT_IDS.workspaceFiles, layout);
          }
          fileTreePanel.recordVisibleFilesLayout(layout);
        }}
      >
        <ResizablePanel
          id="file-tree"
          panelRef={fileTreePanel.fileTreePanelRef}
          collapsible
          collapsedSize={0}
          defaultSize={panelPct(DEFAULT_WORKSPACE_FILES_LAYOUT["file-tree"])}
          minSize={panelPx(PANEL_MIN_PX.fileTree)}
          maxSize={panelPx(PANEL_MAX_PX.fileTree)}
          className="min-w-0"
          onResize={(size) => {
            fileTreePanel.handleFileTreePanelResize(size.asPercentage);
          }}
        >
          <aside className="flex h-full min-h-0 flex-col border-r border-border">
            <WorkspaceFileTree
              entries={entries}
              selectedPath={selectedPath}
              workPath={workPath}
              onSelectFile={onSelectFile}
              onMutated={onMutated}
            />
          </aside>
        </ResizablePanel>

        <ResizableHandle
          className={fileTreePanel.fileTreeCollapsed ? "hidden" : undefined}
        />

        <ResizablePanel
          id="editor"
          defaultSize={panelPct(DEFAULT_WORKSPACE_FILES_LAYOUT.editor)}
          minSize={panelPx(PANEL_MIN_PX.editor)}
          className="min-w-0"
        >
          <WorkspaceFileEditor
            openTabs={openTabs}
            path={selectedPath}
            value={fileContent}
            savedValue={savedContent}
            loading={loadingFile}
            saving={saving}
            readable={readable}
            onChange={onChange}
            onSave={onSave}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
