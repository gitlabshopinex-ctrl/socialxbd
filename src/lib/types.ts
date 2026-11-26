export type Author = {
  id: number;
  handle: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
};

export type FeedVideo = {
  id: number;
  caption: string;
  musicName: string;
  videoUrl: string;
  coverUrl: string | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
  createdAt: string;
  viewerLiked: boolean;
  viewerSaved: boolean;
  viewerFollowsAuthor: boolean;
  status?: string;
  moderationReason?: string | null;
  images?: { url: string; alt?: string }[];
  author: Author;
};

export type CommentItem = {
  id: number;
  text: string;
  likesCount: number;
  createdAt: string;
  author: Author;
};

export type ProfileUser = Author & { bio: string };

export type ProfileData = {
  user: ProfileUser;
  isSelf: boolean;
  viewerFollows: boolean;
  followingCount: number;
  followersCount: number;
  likesReceived: number;
  videos: FeedVideo[];
  likedVideos: FeedVideo[];
  savedVideos: FeedVideo[];
  reviewVideos: FeedVideo[];
};

export type SearchUser = Author & {
  followersCount: number;
  viewerFollows: boolean;
};

export type ActivityItem = {
  key: string;
  type: "like" | "comment" | "follow";
  createdAt: string;
  actor: Author;
  video?: { id: number; coverUrl: string | null; caption: string };
  text?: string;
};