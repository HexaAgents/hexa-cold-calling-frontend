import type { Todo, TodoAssignee, User } from "@/types";

// Ishaan can tick off any task; otherwise the task's creator or anyone it is
// assigned to can tick it off.
export const SUPER_USER_EMAIL = "ishaan@hexaagents.com";

export function canCompleteTodo(todo: Todo, user: User): boolean {
  return (
    todo.assigned_by_id === user.id ||
    isTodoAssignedTo(todo, user.id) ||
    (user.email ?? "").toLowerCase() === SUPER_USER_EMAIL
  );
}

export function getTodoAssignees(todo: Todo): TodoAssignee[] {
  if (todo.assignees && todo.assignees.length > 0) {
    return todo.assignees;
  }
  if (!todo.assigned_to_id) {
    return [];
  }
  return [{ id: todo.assigned_to_id, first_name: todo.assigned_to_name || "Unknown" }];
}

export function isTodoAssignedTo(todo: Todo, userId: string): boolean {
  return getTodoAssignees(todo).some((assignee) => assignee.id === userId);
}

export function assigneePayload(ids: string[], assignees: TodoAssignee[]): TodoAssignee[] {
  const byId = new Map(assignees.map((assignee) => [assignee.id, assignee]));
  return ids.flatMap((id) => {
    const assignee = byId.get(id);
    return assignee ? [assignee] : [];
  });
}
