"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const FEED_TABS = [
  { id: "following", label: "Following", href: "/following" },
  { id: "foryou", label: "For You", href: "/" },
  { id: "photo", label: "Photo", href: "/?feed=photo" },
] as const;

export type FeedTab = (typeof FEED_TABS)[number]["id"];

export default function FeedTabs({
  active,
  visible = true,
  onSelect,
  controls,
  showControls = false,
  onBack,
}: {
  active: FeedTab;
  visible?: boolean;
  onSelect?: (tab: FeedTab) => void;
  controls?: string;
  showControls?: boolean;
  onBack?: () => void;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <nav
      className={cn(
        "sx-feed-tabs",
        visible && "sx-feed-tabs-visible",
        showControls && "sx-feed-tabs-with-controls"
      )}
      aria-label="Feed filters"
      aria-hidden={!visible}
      inert={!visible}
    >
      {showControls && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="sx-feed-tabs-edge sx-feed-tabs-back"
        >
          <ArrowLeft size={22} strokeWidth={1.9} />
        </button>
      )}
      <div
        className="sx-feed-tabs-list"
        role={onSelect ? "tablist" : undefined}
        aria-label="Choose your feed"
      >
        {FEED_TABS.map((item, index) =>
          onSelect ? (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`sx-tab-${item.id}`}
              className="sx-feed-tabs-item"
              aria-selected={active === item.id}
              aria-controls={controls}
              tabIndex={active === item.id ? 0 : -1}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const next =
                  (index + (event.key === "ArrowRight" ? 1 : -1) + FEED_TABS.length) %
                  FEED_TABS.length;
                onSelect(FEED_TABS[next].id);
                (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
              }}
            >
              {item.label}
            </button>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className="sx-feed-tabs-item"
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          )
        )}
      </div>
      {showControls && (
        <Link
          href="/search"
          aria-label="Search"
          className="sx-feed-tabs-edge sx-feed-tabs-search"
        >
          <Search size={21} strokeWidth={1.9} />
        </Link>
      )}
    </nav>
  );
}
