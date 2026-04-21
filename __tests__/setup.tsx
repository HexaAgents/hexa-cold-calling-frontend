import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/contacts",
  useParams: () => ({ id: "test-id" }),
  redirect: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUpload: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/layout/auth-guard", () => ({
  default: ({ children }: { children: (user: { id: string; email: string; full_name: string }) => React.ReactNode }) =>
    children({ id: "test-id", email: "test@hexaagents.com", full_name: "Test User" }),
}));

vi.mock("@/components/layout/app-sidebar", () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn((key: string) => {
      if (key === "access_token") return "fake-token";
      if (key === "user")
        return JSON.stringify({
          id: "test-id",
          email: "test@hexaagents.com",
          full_name: "Test User",
        });
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});
