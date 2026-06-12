"use client";

import { cn } from "@/lib/utils";

interface PageLoaderProps {
  /** Optional status line under the animation, e.g. "Loading contacts". */
  label?: string;
  /** Fill the viewport (auth/page transitions) vs fill the parent container. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Branded loading state: concentric square outlines pulsing outward in the
 * gold primary color (echoing the square-corner design system) around a
 * solid core, with the app name beneath.
 */
export default function PageLoader({
  label,
  fullScreen = false,
  className,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "loader-fade-in flex flex-col items-center justify-center gap-5",
        fullScreen ? "h-screen" : "h-full min-h-[240px] py-16",
        className,
      )}
    >
      <div className="relative h-12 w-12">
        <span className="loader-square" />
        <span className="loader-square" style={{ animationDelay: "0.6s" }} />
        <span className="loader-square" style={{ animationDelay: "1.2s" }} />
        <span className="loader-core absolute inset-[38%] bg-primary" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-sm font-semibold tracking-[0.3em] text-foreground/80 uppercase">
          Hexa
        </span>
        {label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>
    </div>
  );
}
