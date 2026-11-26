"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const PALETTES = [
  "from-rose-500 to-orange-400",
  "from-cyan-400 to-blue-600",
  "from-fuchsia-500 to-purple-700",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-red-500",
  "from-indigo-400 to-sky-600",
];

export default function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  const style = { width: size, height: size };
  if (!src || err) {
    const idx =
      name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length;
    return (
      <div
        style={style}
        className={cn(
          "rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0",
          PALETTES[idx],
          className
        )}
      >
        <span style={{ fontSize: size * 0.42 }}>
          {(name[0] ?? "?").toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      style={style}
      onError={() => setErr(true)}
      className={cn("rounded-full object-cover shrink-0 bg-card", className)}
    />
  );
}