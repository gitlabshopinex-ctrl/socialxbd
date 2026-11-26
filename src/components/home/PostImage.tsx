"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Fixed-size image slots avoid layout shifts; only trusted hosts use our optimizer. */
export default function PostImage({
  src,
  alt,
  sizes,
  eager = false,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  eager?: boolean;
  className?: string;
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const optimized = !!src && (src.startsWith("/") || src.startsWith("https://images.pexels.com/"));

  return (
    <span className={cn("sx-image-slot", className)}>
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          unoptimized={!optimized || src.endsWith(".svg")}
          onError={() => setFailed(true)}
          className="object-cover"
        />
      ) : (
        <span className="sx-image-fallback" role="img" aria-label={alt}>
          {(fallback ?? alt).slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
