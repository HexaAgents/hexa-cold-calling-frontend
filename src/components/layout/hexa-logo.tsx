"use client";

import Image from "next/image";
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
      <Image
        src="/hexa-logo.png"
        alt="Hexa"
        width={size}
        height={size}
        className="rounded-lg"
      />
      {showText && (
        <span className={cn("font-semibold tracking-tight", textClassName)}>
          Hexa
        </span>
      )}
    </div>
  );
}
