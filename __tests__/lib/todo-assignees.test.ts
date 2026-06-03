import { describe, expect, it } from "vitest";
import { assigneePayload, getTodoAssignees, isTodoAssignedTo } from "@/lib/todo-assignees";
import type { Todo, TodoAssignee } from "@/types";

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: "todo-1",
    title: "Task",
    description: null,
    assigned_to_id: null,
    assigned_to_name: null,
    assigned_by_id: "assigner",
    assigned_by_name: "Assigner",
    due_date: null,
    is_done: false,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("todo-assignees utilities", () => {
  it("prefers the canonical multi-assignee list over legacy fields", () => {
    const todo = makeTodo({
      assigned_to_id: "legacy",
      assigned_to_name: "Legacy",
      assignees: [
        { id: "u-1", first_name: "Ishaan" },
        { id: "u-2", first_name: "Srijan" },
      ],
    });

    expect(getTodoAssignees(todo)).toEqual([
      { id: "u-1", first_name: "Ishaan" },
      { id: "u-2", first_name: "Srijan" },
    ]);
  });

  it("falls back to legacy first-assignee fields for older API rows", () => {
    const todo = makeTodo({
      assigned_to_id: "u-legacy",
      assigned_to_name: "Mann",
    });

    expect(getTodoAssignees(todo)).toEqual([{ id: "u-legacy", first_name: "Mann" }]);
    expect(isTodoAssignedTo(todo, "u-legacy")).toBe(true);
    expect(isTodoAssignedTo(todo, "someone-else")).toBe(false);
  });

  it("drops unknown selected ids when building an API payload", () => {
    const assignees: TodoAssignee[] = [
      { id: "u-1", first_name: "Ishaan" },
      { id: "u-2", first_name: "Srijan" },
    ];

    expect(assigneePayload(["u-2", "missing", "u-1"], assignees)).toEqual([
      { id: "u-2", first_name: "Srijan" },
      { id: "u-1", first_name: "Ishaan" },
    ]);
  });
});
