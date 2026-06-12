"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Base shimmer block. Size it with width/height utilities. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer", className)}
      {...props}
    />
  );
}

/** Placeholder for a data table: a header band plus shimmering row cells. */
function TableSkeleton({
  rows = 8,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("loader-fade-in w-full", className)} aria-busy="true">
      <div className="flex gap-3 border-b px-2 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b px-2 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3 flex-1"
              style={{ animationDelay: `${r * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a vertical list of cards. */
function ListSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("loader-fade-in space-y-3", className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder matching the call tracker's contact card layout. */
function ContactCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("loader-fade-in space-y-6 p-6", className)} aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-full max-w-xl" />
        <Skeleton className="h-3.5 w-5/6 max-w-lg" />
        <Skeleton className="h-3.5 w-2/3 max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

export { Skeleton, TableSkeleton, ListSkeleton, ContactCardSkeleton };
