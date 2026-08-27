import { CheckCircle2, Circle, ListTodo, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { TodoItem, TodoPriority, TodoStatus } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

const PRIORITY: Record<TodoPriority, string> = {
  high: "border-[color:color-mix(in_oklab,var(--danger)_35%,transparent)] text-[var(--danger)]",
  medium: "border-[color:color-mix(in_oklab,var(--warning)_35%,transparent)] text-[var(--warning)]",
  low: "border-[var(--border)] text-[var(--muted)]",
};

function order(t: TodoItem): number {
  return { pending: 0, in_progress: 1, completed: 2 }[t.status];
}
function prio(t: TodoItem): number {
  return { high: 0, medium: 1, low: 2 }[t.priority];
}

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />;
  if (status === "in_progress") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--secondary)]" />;
  return <Circle className="h-4 w-4 shrink-0 text-[var(--subtle)]" />;
}

export function TodoPanel() {
  const open = useStore((s) => s.todosOpen);
  const setOpen = useStore((s) => s.setTodosOpen);
  const todos = useStore((s) => s.todos);

  const sorted = [...todos].sort((a, b) => order(a) - order(b) || prio(a) - prio(b) || a.id.localeCompare(b.id));

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      align="top"
      size="md"
      icon={<ListTodo className="h-4 w-4" />}
      title={
        <span className="flex items-center gap-2">
          Todo list
          <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--muted)]">
            {todos.length} task{todos.length === 1 ? "" : "s"}
          </span>
        </span>
      }
    >
      <div className="p-5">
        <p className="mb-4 text-xs text-[var(--muted)]">
          The agent creates and updates these as it works. Stored only in this browser and updates
          live while the agent runs.
        </p>
        {sorted.length === 0 ? (
          <EmptyState icon={<ListTodo className="h-8 w-8" />}>No todos yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {sorted.map((todo) => (
              <li key={todo.id} className={cn("rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3", todo.status === "completed" && "opacity-80")}>
                <div className="flex items-start gap-3">
                  <StatusIcon status={todo.status} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-relaxed", todo.status === "completed" && "text-[var(--muted)] line-through")}>{todo.content}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] capitalize", PRIORITY[todo.priority])}>{todo.priority}</span>
                      <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]">{todo.status.replace("_", " ")}</span>
                      <span className="font-mono text-[10px] text-[var(--subtle)]">#{todo.id}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
