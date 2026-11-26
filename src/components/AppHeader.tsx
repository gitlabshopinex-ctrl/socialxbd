"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import Logo from "@/components/Logo";
import SocialMenuDialog from "@/components/SocialMenuDialog";
import { useUI } from "@/components/UIProvider";

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { inboxUpdateCount } = useUI();

  return (
    <>
      <header className="sx-header" aria-label="SocialX header">
        <button
          type="button"
          className="sx-icon-button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
        >
          <Menu size={23} strokeWidth={1.7} />
        </button>
        <div className="sx-header-logo">
          <Logo size={58} withWordmark={false} />
        </div>
        <Link
          href="/activity"
          aria-label={
            inboxUpdateCount
              ? `Notifications, ${inboxUpdateCount} unread account updates`
              : "Notifications"
          }
          className="sx-icon-button sx-notifications"
        >
          <Bell size={24} strokeWidth={1.7} />
          {inboxUpdateCount > 0 && <span className="sx-notification-dot" aria-hidden="true" />}
        </Link>
      </header>

      {menuOpen && <SocialMenuDialog onClose={() => setMenuOpen(false)} />}
    </>
  );
}
