import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Play,
  X,
  FileArchive,
  Music,
  FileCode,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { AttachedFile } from "@/types";
import { cn } from "@/utils/cn";
import { API_ROUTES, routeUrl } from "@/app/api/routes";

/** Private/previewable mime families used to pick a row icon and decide default behaviour. */
const IMAGE_TYPES = ["image/"];
const AUDIO_TYPES = ["audio/"];
const VIDEO_TYPES = ["video/"];
const CODE_TYPES = ["text/", "application/json", "application/xml", "application/javascript"];

function fileKind(contentType: string): "image" | "audio" | "video" | "code" | "binary" {
  if (IMAGE_TYPES.some((p) => contentType.startsWith(p))) return "image";
  if (AUDIO_TYPES.some((p) => contentType.startsWith(p))) return "audio";
  if (VIDEO_TYPES.some((p) => contentType.startsWith(p))) return "video";
  if (CODE_TYPES.some((p) => contentType.startsWith(p))) return "code";
  return "binary";
}

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  audio: Music,
  video: Play,
  code: FileCode,
  binary: FileArchive,
};

function fileIcon(file: AttachedFile) {
  const kind = fileKind(file.content_type);
  const Icon = KIND_ICONS[kind] ?? FileText;
  const color =
    kind === "image" || kind === "video"
      ? "text-[var(--color-accent-2)]"
      : kind === "audio"
        ? "text-emerald-400"
        : "text-[var(--color-accent)]";
  return <Icon className={cn("h-4 w-4 shrink-0", color)} />;
}

function sizeLabel(file: AttachedFile): string {
  if (file.size_label) return file.size_label;
  const bytes = Number.isFinite(file.size) ? file.size : 0;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * Attached-files popup (styled like the todo popup). Lists the files the attach_files tool gave
 * the user, each with in-app Preview (opens the browser preview panel) and Download actions.
 */
export function FilesPanel() {
  const open = useStore((s) => s.filesOpen);
  const setFilesOpen = useStore((s) => s.setFilesOpen);
  const attachedFiles = useStore((s) => s.attachedFiles);
  const setPreview = useStore((s) => s.setPreview);
  const setPreviewOpen = useStore((s) => s.setPreviewOpen);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (path: string) => routeUrl(API_ROUTES.filesPreview, { query: { path } }),
    [],
  );
  const downloadUrl = useMemo(
    () => (path: string) => routeUrl(API_ROUTES.filesDownload, { query: { path } }),
    [],
  );

  if (!open) return null;

  const previewFile = (file: AttachedFile) => {
    setPreview(previewUrl(file.path));
    setPreviewOpen(true);
    setPreviewing(file.id);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm"
      onClick={() => setFilesOpen(false)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">Attached Files</h2>
            <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
              {attachedFiles.length} file{attachedFiles.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            onClick={() => setFilesOpen(false)}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-2 text-[10px] text-[var(--color-muted)]">
          <Eye className="h-3 w-3" />
          Files the AI attached for you to preview or download.
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {attachedFiles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
              <FileIcon className="h-8 w-8 text-[var(--color-muted)]" />
              <p className="text-sm text-[var(--color-muted)]">
                No attached files yet. Ask the AI to attach a file and it will show up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {attachedFiles.map((file) => (
                <li
                  key={file.id}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    "bg-[var(--color-bg-elev2)]/50 hover:border-[var(--color-accent)]/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
                      {fileIcon(file)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate break-all font-mono text-[13px] font-medium text-[var(--color-fg)]">
                        {file.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]">
                        {file.path}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          {sizeLabel(file)}
                        </span>
                        <span className="max-w-[180px] truncate rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]">
                          {file.content_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => previewFile(file)}
                        disabled={previewing === file.id}
                        className={cn(
                          "flex h-8 items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 text-[11px] text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]",
                          previewing === file.id && "opacity-60",
                        )}
                        title="Preview in the browser preview panel"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      <a
                        href={downloadUrl(file.path)}
                        download={file.name}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}