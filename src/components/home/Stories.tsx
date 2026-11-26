"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import PostImage from "@/components/home/PostImage";
import { useUI } from "@/components/UIProvider";
import type { Author, FeedVideo } from "@/lib/types";

export default function Stories({
  viewer,
  posts,
}: {
  viewer: Author | null;
  posts: FeedVideo[];
}) {
  const { openUpload } = useUI();
  const seen = new Set<number>();
  const creators = posts.filter((post) => {
    if (seen.has(post.author.id) || post.author.id === viewer?.id) return false;
    seen.add(post.author.id);
    return true;
  });

  return (
    <section className="sx-stories no-scrollbar" aria-label="Stories and recent posts from your community">
      <button type="button" className="sx-story" onClick={openUpload} aria-label="Add your story">
        <span className="sx-story-image">
          <PostImage src={viewer?.avatarUrl} alt="Your profile" fallback={viewer?.name ?? "You"} sizes="96px" eager />
          <span className="sx-story-add"><Plus size={18} strokeWidth={2.5} /></span>
        </span>
        <span className="sx-story-name sx-story-name-own">Your Story</span>
      </button>
      {creators.map((post, index) => (
        <Link key={post.author.id} href={`/video/${post.id}`} className="sx-story" aria-label={`View ${post.author.name}'s latest post`}>
          <span className="sx-story-image">
            <PostImage src={post.author.avatarUrl} alt={post.author.name} sizes="96px" eager={index < 3} />
          </span>
          <span className="sx-story-name">{post.author.name.split(" ")[0]}</span>
        </Link>
      ))}
    </section>
  );
}
