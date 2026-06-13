// Avatar-style person labels for the To-Do List.
//
// People are identified by a small colored badge with their two-letter
// initials (e.g. Ishaan Makkar -> IM). The full name is exposed via a
// tooltip/aria-label rather than rendered next to the badge.

import { getPersonAvatarClasses, getPersonInitials } from "@/lib/todo-colors";
import { getTodoAssignees } from "@/lib/todo-assignees";
import type { Todo } from "@/types";

export function PersonAvatar({
  name,
  size = "sm",
  className = "",
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClasses = size === "md" ? "h-6 w-8 text-[11px]" : "h-5 w-7 text-[10px]";
  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase leading-none tracking-tight ${sizeClasses} ${getPersonAvatarClasses(name)} ${className}`}
    >
      {getPersonInitials(name)}
    </span>
  );
}

export function PersonChip({ name }: { name: string | null }) {
  if (!name) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  return <PersonAvatar name={name} />;
}

// Side-by-side row of initials badges; hover any badge for the full name.
export function AssigneeStack({ todo }: { todo: Todo }) {
  const assignees = getTodoAssignees(todo);
  if (assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {assignees.map((assignee) => (
        <PersonAvatar key={assignee.id} name={assignee.first_name} />
      ))}
    </span>
  );
}
