import ProfileView from "@/components/ProfileView";
import { getCurrentHandle, getCurrentUserId, getProfile } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [viewerId, handle] = await Promise.all([getCurrentUserId(), getCurrentHandle()]);
  const initialProfile = await getProfile(handle, viewerId);
  return <ProfileView handle={handle} initialProfile={initialProfile} />;
}
