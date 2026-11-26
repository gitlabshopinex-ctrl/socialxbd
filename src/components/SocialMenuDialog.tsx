"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Database, Radio, Search, ShieldCheck } from "lucide-react";
import HomeDialog from "@/components/home/HomeDialog";
import { useUI } from "@/components/UIProvider";
import { activeNavigation, PRIMARY_NAVIGATION } from "@/lib/navigation";

const MORE_LINKS = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/search", label: "Search SocialX", icon: Search },
  { href: "/activity", label: "Notifications", icon: Bell },
  { href: "/live", label: "LIVE", icon: Radio },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/studio/media", label: "Media studio", icon: Database },
] as const;

export default function SocialMenuDialog({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { openUpload, uploadOpen } = useUI();
  const activeId = activeNavigation(pathname, uploadOpen);

  return (
    <HomeDialog title="SocialX" className="sx-menu-dialog" onClose={onClose}>
      <p className="sx-menu-caption">Your people. Your perspective.</p>
      <nav className="sx-menu-links" aria-label="Site navigation">
        {PRIMARY_NAVIGATION.map((item) => {
          const Icon = item.icon;
          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              aria-current={activeId === item.id ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={1.8} />
              {item.label}
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onClose();
                openUpload();
              }}
            >
              <Icon size={21} strokeWidth={1.8} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <nav className="sx-menu-links sx-menu-secondary" aria-label="More SocialX pages">
        {MORE_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={21} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </nav>
      <p className="sx-menu-footer">© {new Date().getFullYear()} SocialX</p>
    </HomeDialog>
  );
}
