import { describe, expect, it } from "vitest";
import { assigneePayload, canCompleteTodo, getTodoAssignees, isTodoAssignedTo } from "@/lib/todo-assignees";
import type { Todo, TodoAssignee, User } from "@/types";

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
    recurrence_interval: null,
    recurrence_unit: null,
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

  it("lets the creator tick off a task but not an unrelated user", () => {
    const todo = makeTodo({ assigned_by_id: "assigner" });
    const creator: User = { id: "assigner", email: "creator@hexaagents.com", full_name: "Creator" };
    const unrelated: User = { id: "u-unrelated", email: "unrelated@hexaagents.com", full_name: "Unrelated" };

    expect(canCompleteTodo(todo, creator)).toBe(true);
    expect(canCompleteTodo(todo, unrelated)).toBe(false);
  });

  it("lets a person the task is assigned to tick it off", () => {
    const todo = makeTodo({
      assigned_by_id: "assigner",
      assignees: [{ id: "u-assignee", first_name: "Assignee" }],
    });
    const assignee: User = { id: "u-assignee", email: "assignee@hexaagents.com", full_name: "Assignee" };

    expect(canCompleteTodo(todo, assignee)).toBe(true);
  });

  it("lets a legacy single-assignee tick off a task", () => {
    const todo = makeTodo({ assigned_by_id: "assigner", assigned_to_id: "u-legacy" });
    const legacy: User = { id: "u-legacy", email: "legacy@hexaagents.com", full_name: "Legacy" };

    expect(canCompleteTodo(todo, legacy)).toBe(true);
  });

  it("lets the super user tick off any task regardless of creator", () => {
    const todo = makeTodo({ assigned_by_id: "someone-else" });
    const ishaan: User = { id: "u-ishaan", email: "ishaan@hexaagents.com", full_name: "Ishaan Makkar" };
    const ishaanUpper: User = { ...ishaan, email: "Ishaan@HexaAgents.com" };

    expect(canCompleteTodo(todo, ishaan)).toBe(true);
    expect(canCompleteTodo(todo, ishaanUpper)).toBe(true);
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
