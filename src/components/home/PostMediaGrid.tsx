import Link from "next/link";
import { Play } from "lucide-react";
import PostImage from "@/components/home/PostImage";
import { cn } from "@/lib/utils";

export type PostMedia = {
  src: string;
  alt: string;
  href: string;
  kind?: "photo" | "video-preview";
};

/** Supports native photo galleries as well as individually linked post covers. */
export default function PostMediaGrid({
  media,
  eager = false,
}: {
  media: PostMedia[];
  eager?: boolean;
}) {
  if (!media.length) return null;

  return (
    <div
      className={cn(
        "sx-media-grid",
        media.length === 1 && "sx-media-grid-single",
        media.length > 2 && "sx-media-grid-many"
      )}
    >
      {media.slice(0, 4).map((image, index) => (
        <Link
          key={`${image.src}-${index}`}
          href={image.href}
          className="sx-media-tile"
          aria-label={image.alt}
          prefetch
          onPointerDown={(event) => {
            // Start the route prefetch before the browser emits click on touch.
            if (event.pointerType === "touch") (event.currentTarget as HTMLAnchorElement).focus();
          }}
        >
          <PostImage
            src={image.src}
            alt={image.alt}
            sizes={
              media.length === 1
                ? "(max-width: 640px) calc(100vw - 32px), 592px"
                : "(max-width: 640px) calc((100vw - 40px) / 2), 292px"
            }
            eager={eager}
          />
          {image.kind === "video-preview" && (
            <span className="sx-media-play" aria-hidden="true">
              <Play size={12} fill="currentColor" />
            </span>
          )}
          {index === 3 && media.length > 4 && (
            <span className="sx-media-more">+{media.length - 4}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
