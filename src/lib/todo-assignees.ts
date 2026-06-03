import type { Todo, TodoAssignee } from "@/types";

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
