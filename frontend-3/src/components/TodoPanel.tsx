import { X, ListTodo, CircleDot, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { TodoItem, TodoPriority, TodoStatus } from "@/types";
import { cn } from "@/utils/cn";

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  low: "border-[var(--color-border)] text-[var(--color-muted)]",
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

const STATUS_ICONS: Record<TodoStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
};

const STATUS_LABELS: Record<TodoStatus, string> = {
  pending: "pending",
  in_progress: "in progress",
  completed: "completed",
};

function statusRow(status: TodoStatus): string {
  if (status === "completed") return "border-emerald-500/20 hover:bg-emerald-500/5";
  if (status === "in_progress") return "border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/5";
  return "border-[var(--color-border)] hover:bg-[var(--color-bg-elev2)]/60";
}

function StatusIcon({ todo }: { todo: TodoItem }) {
  const Icon = STATUS_ICONS[todo.status];
  if (todo.status === "completed")
    return <Icon className="h-4 w-4 shrink-0 text-emerald-400" />;
  if (todo.status === "in_progress")
    return <Icon className="h-4 w-4 shrink-0 animate-spin text-[var(--color-accent-2)]" />;
  return <Icon className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />;
}

function sortTodos(a: TodoItem, b: TodoItem): number {
  const order: Record<TodoStatus, number> = { pending: 0, in_progress: 1, completed: 2 };
  const prio: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
  if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority];
  return a.id.localeCompare(b.id);
}

export function TodoPanel() {
  const open = useStore((s) => s.todosOpen);
  const setOpen = useStore((s) => s.setTodosOpen);
  const todos = useStore((s) => s.todos);

  if (!open) return null;

  const sorted = [...todos].sort(sortTodos);
  const pendingCount = todos.filter((t) => t.status === "pending").length;
  const inProgressCount = todos.filter((t) => t.status === "in_progress").length;
  const completedCount = todos.filter((t) => t.status === "completed").length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">Todo List</h2>
            <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
              {todos.length} task{todos.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-2 text-[10px] text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <CircleDot className="h-3 w-3" />
            {pendingCount} pending
          </span>
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 text-[var(--color-accent-2)]" />
            {inProgressCount} in progress
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            {completedCount} completed
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-xs text-[var(--color-muted)]">
            Your AI agent creates and updates these todos as it works. This list is stored only in
            this browser and updates live while the agent runs.
          </p>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
              <ListTodo className="h-8 w-8 text-[var(--color-muted)]" />
              <p className="text-sm text-[var(--color-muted)]">No todos yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sorted.map((todo) => (
                <li
                  key={todo.id}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    "bg-[var(--color-bg-elev2)]/50",
                    statusRow(todo.status),
                    todo.status === "completed" && "opacity-80",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon todo={todo} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm leading-relaxed",
                          todo.status === "completed" && "text-[var(--color-muted)] line-through",
                        )}
                      >
                        {todo.content}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[10px] capitalize",
                            PRIORITY_STYLES[todo.priority],
                          )}
                        >
                          {PRIORITY_LABELS[todo.priority]}
                        </span>
                        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--color-muted)]">
                          {STATUS_LABELS[todo.status]}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-muted)]">
                          #{todo.id}
                        </span>
                      </div>
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