"use client";

import { cn } from "@/lib/utils";

interface HexaLogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export default function HexaLogo({
  size = 32,
  showText = false,
  textClassName = "",
}: HexaLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center rounded-lg bg-primary overflow-hidden"
        style={{ width: size, height: size }}
      >
        <span
          className="font-bold text-primary-foreground"
          style={{ fontSize: size * 0.4 }}
        >
          H
        </span>
      </div>
      {showText && (
        <span className={cn("font-semibold tracking-tight", textClassName)}>
          Hexa
        </span>
      )}
    </div>
  );
}
