"use client";

import { useParams } from "next/navigation";
import ProfileView from "@/components/ProfileView";

export default function UserPage() {
  const params = useParams<{ handle: string }>();
  return <ProfileView handle={decodeURIComponent(params.handle)} />;
}