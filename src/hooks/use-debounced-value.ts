"use client";

import { useEffect, useState } from "react";

/**
 * Returns a value that only updates after `delay` ms of no changes.
 * Used to debounce search inputs so the API is hit once per pause in
 * typing instead of once per keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}
