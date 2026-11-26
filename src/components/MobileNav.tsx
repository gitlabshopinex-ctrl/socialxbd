"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/components/UIProvider";
import { activeNavigation, PRIMARY_NAVIGATION } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** One persistent navigation instance across all SocialX pages. */
export default function MobileNav() {
  const pathname = usePathname();
  const { openUpload, uploadOpen, inboxUpdateCount, setInboxUpdateCount } = useUI();
  const activeId = activeNavigation(pathname, uploadOpen);
  const profileTheme =
    pathname === "/profile" || pathname.startsWith("/user/");
  if (pathname.startsWith("/profile/video/")) return null;

  useEffect(() => {
    if (pathname !== "/activity") return;
    try {
      window.localStorage.setItem("sx-inbox-seen-at", new Date().toISOString());
    } catch {
      /* Storage can be disabled. */
    }
    setInboxUpdateCount(0);
  }, [pathname, setInboxUpdateCount]);

  return (
    <nav className={cn("sx-bottom-nav", profileTheme && "sx-bottom-nav-profile")} aria-label="Main navigation">
      {PRIMARY_NAVIGATION.map((item) => {
        const Icon = item.icon;
        const active = activeId === item.id;
        if (!item.href) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={openUpload}
              onPointerEnter={() => {
                void import("@/components/UploadModal");
              }}
              onFocus={() => {
                void import("@/components/UploadModal");
              }}
              aria-label={item.label}
              aria-expanded={uploadOpen}
              aria-haspopup="dialog"
              className={cn("sx-bottom-nav-create", active && "sx-bottom-nav-active")}
            >
              <span>
                <Icon size={24} strokeWidth={2.5} />
              </span>
            </button>
          );
        }
        const showChatBadge = item.id === "chat" && inboxUpdateCount > 0;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn("sx-bottom-nav-link", active && "sx-bottom-nav-active")}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            <span className="sx-bottom-nav-icon">
              <Icon
                size={23}
                strokeWidth={active ? 2.2 : 1.8}
                fill={(item.id === "home" || item.id === "profile") && active ? "currentColor" : "none"}
              />
              {showChatBadge && (
                <span className="sx-unread-badge" aria-hidden="true">
                  {inboxUpdateCount > 9 ? "9+" : inboxUpdateCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
