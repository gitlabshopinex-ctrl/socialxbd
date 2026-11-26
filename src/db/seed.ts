import "dotenv/config";
import { db, pool } from "./index";
import { users, videos, likes, saves, follows, comments } from "./schema";
import { eq } from "drizzle-orm";

const avatar = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160`;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

const USERS = [
  { handle: "alex.rivera", name: "Alex Rivera", avatarUrl: avatar(36586364), bio: "just here to make cool stuff ✨\nnew edits every week", verified: false },
  { handle: "maya.moves", name: "Maya Chen", avatarUrl: avatar(698532), bio: "dancer / choreographer 💃\nbookings → maya@socialx.demo", verified: true },
  { handle: "leo.eats", name: "Leo Martínez", avatarUrl: avatar(5308640), bio: "chef 👨‍🍳 recipes in 60 seconds\nrecipes below every video", verified: true },
  { handle: "wild.ana", name: "Ana Petrova", avatarUrl: avatar(40322798), bio: "chasing waterfalls 🌿\n43 countries and counting", verified: false },
  { handle: "neon.ken", name: "Ken Ito", avatarUrl: avatar(27544052), bio: "city lights & night rides 🌃\nshot on phone", verified: false },
  { handle: "coach.dre", name: "Dre Johnson", avatarUrl: avatar(14950779), bio: "5am club coach 🏋️\nno excuses", verified: false },
  { handle: "puppy.pia", name: "Pia Novak", avatarUrl: avatar(16869444), bio: "professional puppy paparazzi 🐶", verified: false },
  { handle: "skate.sam", name: "Sam Ortiz", avatarUrl: avatar(6102841), bio: "send it 🛹 (safely)", verified: false },
  { handle: "wander.jo", name: "Jordan Lee", avatarUrl: avatar(35681211), bio: "sunsets are my love language 🌅", verified: false },
  { handle: "dj.nova", name: "DJ Nova", avatarUrl: avatar(35490803), bio: "your favorite sound 🎧\nLIVE every friday", verified: true },
];

type SeedVideo = {
  by: string;
  caption: string;
  music: string;
  url: string;
  cover: string;
};

const V = (by: string, caption: string, music: string, file: string, cover: string): SeedVideo => ({
  by,
  caption,
  music,
  url: `https://videos.pexels.com/video-files/${file}`,
  cover: `https://images.pexels.com/videos/${cover}`,
});

const VIDEOS: SeedVideo[] = [
  V("maya.moves", "POV: the beat drops and the street becomes your stage 💃 #dance #fyp #viral", "Midnight Groove – DJ Nova", "8928299/8928299-hd_1080_1920_30fps.mp4", "8928299/action-energy-active-adolescent-adult-8928299.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("leo.eats", "Garlic butter shrimp in 10 minutes 🍤 recipe in the comments! #food #recipe #cooking #foodtok", "Kitchen Jazz – Trio Bleu", "40995596/17536711_2160_3840_25fps.mp4", "40995596/pexels-photo-40995596.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("wild.ana", "Found paradise and kept it secret 🤫💦 #nature #waterfall #hiking #travel", "Forest Ambience – Earthtones", "36207485/15354301_2160_3840_60fps.mp4", "36207485/pexels-photo-36207485.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("neon.ken", "Night rides through the neon city 🚲🌃 #citylife #nightride #neon", "Neon Nights – VHS Dreams", "36458948/15459775_2160_3840_24fps.mp4", "36458948/pexels-photo-36458948.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("alex.rivera", "My first drone edit! Green hills for days 🌿 shot with @wild.ana #nature #drone #firstpost", "original sound – alex.rivera", "28870584/12500493_2160_3840_60fps.mp4", "28870584/4k-background-4k-drone-4k-drone-footage-4k-drone-video-28870584.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("puppy.pia", "They discovered grass for the first time 🐶😭 #puppy #dogs #cute #fyp", "Happy Day – Sunshine Kids", "9314159/9314159-uhd_2160_3840_25fps.mp4", "9314159/animal-baby-bird-canine-9314159.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("skate.sam", "Landed it first try (take 47) 🛹😅 #skate #tricks #sendit", "Skate or Die – The Pushers", "32361183/13806495_1080_1920_30fps.mp4", "32361183/park-skateboarding-skate-skateboard-skateboarder-32361183.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("coach.dre", "5am club. No excuses. 🚴💨 #fitness #grind #motivation #gym", "Beast Mode – Hype Beats", "37515281/15893845_2160_3840_25fps.mp4", "37515281/cycling-fitness-training-gym-gym-training-37515281.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("wander.jo", "33 seconds of pure serotonin 🌅 save this for a bad day #sunset #ocean #travel #peace", "Ocean Waves – Calm Collective", "28459255/12389361_2160_3840_60fps.mp4", "28459255/amazing-beach-beach-sunset-beautiful-sunset-28459255.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("maya.moves", "learning this choreo took 3 weeks… worth it 🥹 #dance #choreography #fyp", "original sound – maya.moves", "4753978/4753978-hd_1080_1920_25fps.mp4", "4753978/choreography-dance-dancer-dancing-4753978.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("leo.eats", "Knife skills 101: the perfect dice 🧅🔪 #cooking #foodtok #chef #knife", "original sound – leo.eats", "34228459/14506593_2160_3840_60fps.mp4", "34228459/pexels-photo-34228459.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("alex.rivera", "My dog vs the sprinkler 😂 summer arc begins #dogs #summer #funny", "original sound – alex.rivera", "34931516/14796650_1080_1920_30fps.mp4", "34931516/pexels-photo-34931516.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("wild.ana", "POV: you wake up above the clouds ☁️ #nature #drone #mountains #aerial", "Above the Clouds – Aer", "28870671/12500458_2160_3840_60fps.mp4", "28870671/4k-background-4k-drone-4k-drone-footage-4k-drone-video-28870671.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("neon.ken", "Wait for the tilt 🏙️ architecture hits different at night #city #architecture #night", "original sound – neon.ken", "16148130/16148130-uhd_2160_3840_30fps.mp4", "16148130/pexels-photo-16148130.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("coach.dre", "Tire flips > treadmill. Fight me 🔥 #workout #strength #fitness", "original sound – coach.dre", "30535403/13079835_1080_1920_30fps.mp4", "30535403/pexels-photo-30535403.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("wander.jo", "He walks the beach every sunset 🐕🌅 #beach #dog #travel #goldenhour", "original sound – wander.jo", "20257645/20257645-hd_1080_1920_30fps.mp4", "20257645/canary-islands-holiday-lanzarote-spain-20257645.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("skate.sam", "This line took all summer 🔥🛹 #skateboarding #skatepark #fyp", "original sound – skate.sam", "32304939/13777129_1080_1920_24fps.mp4", "32304939/chicago-32304939.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("maya.moves", "golden hour freestyle ✨ #dance #goldenhour #streetdance", "Sunset Drive – Lumen", "8928350/8928350-hd_1080_1920_30fps.mp4", "8928350/action-adult-architecture-beautiful-8928350.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
  V("leo.eats", "Fresh pasta from scratch 🍝 nonna approved #pasta #foodtok #homemade", "original sound – leo.eats", "30939799/13229479_1080_1920_25fps.mp4", "30939799/pexels-photo-30939799.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630"),
];

const COMMENT_POOL = [
  "this is unreal 🔥",
  "how do you even do this 😭",
  "instant follow!!",
  "the algorithm blessed me today",
  "tutorial pls 🙏",
  "saving this forever",
  "who else is here at 3am 💀",
  "this deserves more views",
  "certified banger 🔊",
  "the vibes are immaculate ✨",
  "I watched this 12 times already",
  "POV: you found the best side of the internet",
  "okay but the SOUND choice 🎯",
  "showing this to everyone I know",
];

async function main() {
  console.log("Seeding SocialX demo data…");

  await db.delete(likes);
  await db.delete(saves);
  await db.delete(comments);
  await db.delete(follows);
  await db.delete(videos);
  await db.delete(users);

  const insertedUsers = await db.insert(users).values(USERS).returning();
  const uid = new Map(insertedUsers.map((u) => [u.handle, u.id]));
  const me = uid.get("alex.rivera")!;

  const videoRows = VIDEOS.map((v, i) => {
    const viral = i % 5 === 0;
    const mine = v.by === "alex.rivera";
    const base = (((i * 37) % 90) + 10) * 1000 + ((i * 911) % 1000);
    const likesCount = mine ? 850 + i * 130 : viral ? base * 8 : base;
    return {
      userId: uid.get(v.by)!,
      caption: v.caption,
      musicName: v.music,
      videoUrl: v.url,
      coverUrl: v.cover,
      viewsCount: likesCount * 12 + i * 733,
      likesCount,
      commentsCount: 0,
      savesCount: Math.floor(likesCount * 0.08),
      sharesCount: Math.floor(likesCount * 0.03),
      createdAt: hoursAgo(3 + i * 7),
    };
  });
  const insertedVideos = await db.insert(videos).values(videoRows).returning();

  // Comments (2–3 per video, from other creators)
  const commentRows: { videoId: number; userId: number; text: string; likesCount: number; createdAt: Date }[] = [];
  const otherHandles = USERS.map((u) => u.handle).filter((h) => h !== "alex.rivera");
  insertedVideos.forEach((vid, i) => {
    const authorHandle = VIDEOS[i].by;
    const count = 2 + (i % 2);
    for (let j = 0; j < count; j++) {
      const pool = otherHandles.filter((h) => h !== authorHandle);
      const handle = pool[(i * 3 + j * 5) % pool.length];
      commentRows.push({
        videoId: vid.id,
        userId: uid.get(handle)!,
        text: COMMENT_POOL[(i * 3 + j * 7) % COMMENT_POOL.length],
        likesCount: (i * 13 + j * 7) % 400,
        createdAt: hoursAgo(Math.max(0.5, 3 + i * 7 - 1 - j * 0.7)),
      });
    }
  });
  // Extra comments on my videos for the activity feed
  commentRows.push(
    { videoId: insertedVideos[4].id, userId: uid.get("puppy.pia")!, text: "this view 😍 where is this?!", likesCount: 12, createdAt: hoursAgo(2) },
    { videoId: insertedVideos[11].id, userId: uid.get("skate.sam")!, text: "the sprinkler arc 😂😂", likesCount: 8, createdAt: hoursAgo(1.5) }
  );
  await db.insert(comments).values(commentRows);
  for (const vid of insertedVideos) {
    const n = commentRows.filter((c) => c.videoId === vid.id).length;
    await db.update(videos).set({ commentsCount: n }).where(eq(videos.id, vid.id));
  }

  // Follows: me → creators, creators → me, plus cross-follows
  const followPairs: [string, string][] = [
    ["alex.rivera", "maya.moves"],
    ["alex.rivera", "leo.eats"],
    ["alex.rivera", "puppy.pia"],
    ["alex.rivera", "skate.sam"],
    ["alex.rivera", "wild.ana"],
    ["leo.eats", "alex.rivera"],
    ["puppy.pia", "alex.rivera"],
    ["neon.ken", "alex.rivera"],
    ["wander.jo", "alex.rivera"],
    ["maya.moves", "alex.rivera"],
    ["maya.moves", "dj.nova"],
    ["dj.nova", "maya.moves"],
    ["leo.eats", "wild.ana"],
    ["wild.ana", "wander.jo"],
    ["wander.jo", "wild.ana"],
    ["skate.sam", "neon.ken"],
    ["neon.ken", "skate.sam"],
    ["coach.dre", "skate.sam"],
    ["puppy.pia", "wander.jo"],
    ["dj.nova", "neon.ken"],
    ["coach.dre", "dj.nova"],
    ["leo.eats", "puppy.pia"],
    ["maya.moves", "puppy.pia"],
    ["wild.ana", "coach.dre"],
  ];
  await db.insert(follows).values(
    followPairs.map(([a, b], i) => ({
      followerId: uid.get(a)!,
      followingId: uid.get(b)!,
      createdAt: hoursAgo(6 + i * 3),
    }))
  );

  // My likes (Liked tab) + likes on my videos (activity)
  await db.insert(likes).values([
    { userId: me, videoId: insertedVideos[0].id, createdAt: hoursAgo(2.5) },
    { userId: me, videoId: insertedVideos[5].id, createdAt: hoursAgo(2) },
    { userId: me, videoId: insertedVideos[8].id, createdAt: hoursAgo(1) },
    { userId: uid.get("maya.moves")!, videoId: insertedVideos[4].id, createdAt: hoursAgo(2.2) },
    { userId: uid.get("neon.ken")!, videoId: insertedVideos[4].id, createdAt: hoursAgo(1.8) },
    { userId: uid.get("puppy.pia")!, videoId: insertedVideos[11].id, createdAt: hoursAgo(1.2) },
    { userId: uid.get("wander.jo")!, videoId: insertedVideos[11].id, createdAt: hoursAgo(0.8) },
  ]);

  // My saves
  await db.insert(saves).values([
    { userId: me, videoId: insertedVideos[1].id, createdAt: hoursAgo(2.4) },
    { userId: me, videoId: insertedVideos[2].id, createdAt: hoursAgo(1.6) },
  ]);

  console.log(
    `Done: ${insertedUsers.length} users, ${insertedVideos.length} videos, ${commentRows.length} comments, ${followPairs.length} follows.`
  );
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });