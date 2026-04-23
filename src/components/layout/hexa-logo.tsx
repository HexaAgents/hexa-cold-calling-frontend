"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface HexaLogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  variant?: "dark" | "light";
}

export default function HexaLogo({
  size = 32,
  showText = false,
  textClassName = "",
  variant = "dark",
}: HexaLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/hexa-logo.png"
        alt="Hexa"
        width={size}
        height={size}
        className={cn("rounded-lg", variant === "light" && "invert")}
      />
      {showText && (
        <span className={cn("font-semibold tracking-tight", textClassName)}>
          Hexa
        </span>
      )}
    </div>
  );
}
