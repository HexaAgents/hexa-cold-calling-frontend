"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AppSidebar from "@/components/layout/app-sidebar";
import HexaLogo from "@/components/layout/hexa-logo";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

interface AppShellProps {
  user: User | null;
  title?: string;
  mainClassName?: string;
  children: React.ReactNode;
}

/**
 * Responsive app chrome shared by all authenticated pages.
 * - lg+: fixed 248px sidebar next to the scrollable main area (unchanged desktop UI).
 * - <lg: sticky top header with a hamburger that opens the sidebar as a slide-over drawer.
 */
export default function AppShell({ user, title, mainClassName, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation happens (adjust state during render).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
  }

  // Prevent background scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const original = document.body.style.touchAction;
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.touchAction = original;
    };
  }, [drawerOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* Desktop sidebar */}
      <div className="hidden h-full lg:flex">
        <AppSidebar user={user} />
      </div>

      {/* Mobile top header */}
      <header className="pt-safe flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center text-foreground"
        >
          <Menu size={20} />
        </button>
        <HexaLogo size={20} showText textClassName="text-sm" />
        {title && (
          <span className="ml-auto truncate text-sm font-medium text-muted-foreground">
            {title}
          </span>
        )}
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/55 animate-in fade-in duration-150"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="relative flex h-full w-full">
              <div className="flex h-full w-full [&>aside]:w-full">
                <AppSidebar user={user} />
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-2 top-4 flex h-9 w-9 items-center justify-center text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main
        className={cn(
          "relative flex-1 overflow-y-auto bg-background pb-safe",
          mainClassName
        )}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-primary/30 via-primary/70 to-primary/30" />
        {children}
      </main>
    </div>
  );
}
