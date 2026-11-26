import { Home, MessageSquare, Plus, UserRound } from "lucide-react";
import ShortsIcon from "@/components/ShortsIcon";

/** The header menu and persistent navigation share the exact same destinations. */
export const PRIMARY_NAVIGATION = [
  { id: "home", label: "Home", href: "/", icon: Home },
  { id: "friends", label: "Shorts", href: "/following", icon: ShortsIcon },
  { id: "create", label: "Create post", href: null, icon: Plus },
  { id: "chat", label: "Chat", href: "/messages", icon: MessageSquare },
  { id: "profile", label: "Profile", href: "/profile", icon: UserRound },
] as const;

export type PrimaryNavigationId = (typeof PRIMARY_NAVIGATION)[number]["id"];

export function activeNavigation(pathname: string, creating = false): PrimaryNavigationId {
  if (creating) return "create";
  if (pathname === "/following" || pathname.startsWith("/friends") || pathname === "/shorts") return "friends";
  if (pathname === "/messages" || pathname.startsWith("/messages/") || pathname === "/activity") return "chat";
  if (pathname === "/profile" || pathname.startsWith("/user/")) return "profile";
  return "home";
}
