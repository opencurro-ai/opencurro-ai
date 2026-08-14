import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ChevronRight, Folder, FolderOpen, File as FileIcon, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { fetchFileContent, fetchFileTree } from "@/lib/api";
import type { FileNode } from "@/types";
import { cn } from "@/utils/cn";

export function FileExplorer() {
  const filesVersion = useStore((s) => s.filesVersion);
  const streaming = useStore((s) => s.streaming);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTree(await fetchFileTree());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh when tools change the filesystem (bumped from the chat hook) and on mount.
  useEffect(() => {
    refresh();
  }, [refresh, filesVersion]);

  // While the agent is running, poll so the tree updates in near real time.
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [streaming, refresh]);

  const openFile = async (path: string) => {
    try {
      const content = await fetchFileContent(path);
      setPreview({ path, content });
    } catch (e) {
      setPreview({
        path,
        content: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Workspace
        </h3>
        <button
          onClick={refresh}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
        {error && <p className="px-2 py-3 text-xs text-red-300">{error}</p>}
        {!error && tree.length === 0 && !loading && (
          <p className="px-2 py-6 text-center text-xs text-[var(--color-muted)]">
            Empty workspace. Files the agent creates appear here.
          </p>
        )}
        <TreeList nodes={tree} depth={0} onOpen={openFile} activePath={preview?.path} />
      </div>

      {preview && (
        <div className="flex max-h-[45%] flex-col border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="truncate text-xs font-medium text-[var(--color-fg)]">{preview.path}</span>
            <button
              onClick={() => setPreview(null)}
              className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto bg-[var(--color-bg)] px-3 pb-3 text-[11px] leading-relaxed text-[var(--color-muted)]">
            <code>{preview.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

function TreeList({
  nodes,
  depth,
  onOpen,
  activePath,
}: {
  nodes: FileNode[];
  depth: number;
  onOpen: (path: string) => void;
  activePath?: string;
}) {
  return (
    <ul>
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} depth={depth} onOpen={onOpen} activePath={activePath} />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  depth,
  onOpen,
  activePath,
}: {
  node: FileNode;
  depth: number;
  onOpen: (path: string) => void;
  activePath?: string;
}) {
  const [open, setOpen] = useState(depth < 1);
  const pad = { paddingLeft: 8 + depth * 12 };

  if (node.type === "dir") {
    return (
      <li>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[var(--color-fg)] transition hover:bg-[var(--color-bg-elev2)]"
          style={pad}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[var(--color-muted)] transition-transform",
              open && "rotate-90",
            )}
          />
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-2)]" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-2)]" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 && (
          <TreeList nodes={node.children} depth={depth + 1} onOpen={onOpen} activePath={activePath} />
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={() => onOpen(node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left transition hover:bg-[var(--color-bg-elev2)]",
          activePath === node.path ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]",
        )}
        style={{ paddingLeft: 8 + depth * 12 + 18 }}
      >
        <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
