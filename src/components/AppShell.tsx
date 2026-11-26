"use client";

import { useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { useUI } from "@/components/UIProvider";
import { cn } from "@/lib/utils";

const UploadModal = dynamic(() => import("@/components/UploadModal"), {
  loading: () => (
    <div className="sx-overlay-loading" role="status" aria-live="polite">
      <div className="sx-create-loading">
        <span className="sx-skeleton h-5 w-32 rounded" />
        <span className="sx-skeleton mt-5 h-36 w-full rounded-xl" />
        <span className="sr-only">Loading create post…</span>
      </div>
    </div>
  ),
});

/** The SX brand header appears only on the Homepage; opened posts/videos use the immersive overlay bar. */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { uploadOpen } = useUI();
  const isHome = pathname === "/";

  // Refresh identity cookies once per session so ownership checks follow a username change.
  useEffect(() => {
    fetch("/api/me").catch(() => {});
  }, []);
  const profileViewer = pathname.startsWith("/profile/video/");
  const isProfile = !profileViewer && (pathname === "/profile" || pathname.startsWith("/user/"));

  return (
    <div className={cn("sx-app", !isHome && "sx-app-no-header", isProfile && "sx-app-light", profileViewer && "sx-app-profile-viewer")}>
      {isHome && (
        <div className="sx-app-header">
          <AppHeader />
        </div>
      )}
      <main id="main-content" className="sx-app-main">
        {children}
      </main>
      {uploadOpen && <UploadModal />}
    </div>
  );
}
