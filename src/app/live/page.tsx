"use client";

import { useState } from "react";
import { Eye, Radio } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useUI } from "@/components/UIProvider";
import { cn, formatCount } from "@/lib/utils";

const AVATARS = {
  nova: "https://images.pexels.com/photos/35490803/pexels-photo-35490803.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  maya: "https://images.pexels.com/photos/698532/pexels-photo-698532.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  ken: "https://images.pexels.com/photos/27544052/pexels-photo-27544052.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  dre: "https://images.pexels.com/photos/14950779/pexels-photo-14950779.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  sam: "https://images.pexels.com/photos/6102841/pexels-photo-6102841.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  pia: "https://images.pexels.com/photos/16869444/pexels-photo-16869444.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
};

const STREAMS = [
  {
    title: "FRIDAY NIGHT SET 🎧 request a track!",
    handle: "dj.nova",
    avatar: AVATARS.nova,
    viewers: 12400,
    img: "https://images.pexels.com/photos/13137879/pexels-photo-13137879.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
  },
  {
    title: "festival main stage — we are LIVE",
    handle: "dj.nova",
    avatar: AVATARS.nova,
    viewers: 8900,
    img: "https://images.pexels.com/photos/9534914/pexels-photo-9534914.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
  },
  {
    title: "dance practice + Q&A 💃 come hang",
    handle: "maya.moves",
    avatar: AVATARS.maya,
    viewers: 5200,
    img: "https://images.pexels.com/videos/8928299/action-energy-active-adolescent-adult-8928299.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  },
  {
    title: "light show from the pit ✨",
    handle: "neon.ken",
    avatar: AVATARS.ken,
    viewers: 3100,
    img: "https://images.pexels.com/photos/12174129/pexels-photo-12174129.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
  },
  {
    title: "late night crowd vibes 🌃",
    handle: "neon.ken",
    avatar: AVATARS.ken,
    viewers: 2700,
    img: "https://images.pexels.com/photos/9534908/pexels-photo-9534908.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
  },
  {
    title: "5am spin club — join the grind 🚴",
    handle: "coach.dre",
    avatar: AVATARS.dre,
    viewers: 1900,
    img: "https://images.pexels.com/videos/37515281/cycling-fitness-training-gym-gym-training-37515281.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  },
  {
    title: "skate session until the wheels fall off",
    handle: "skate.sam",
    avatar: AVATARS.sam,
    viewers: 1400,
    img: "https://images.pexels.com/videos/32304939/chicago-32304939.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  },
  {
    title: "puppy cam 🐶 they never sleep",
    handle: "puppy.pia",
    avatar: AVATARS.pia,
    viewers: 6300,
    img: "https://images.pexels.com/videos/9314159/animal-baby-bird-canine-9314159.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  },
];

const CHIPS = ["For You", "Music", "Dance", "Gaming", "Chat", "Fitness", "Pets"];

export default function LivePage() {
  const { toast } = useUI();
  const [chip, setChip] = useState("For You");

  return (
    <div className="px-3 md:px-6 py-4 pb-20 md:pb-10 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Radio size={22} className="text-accent" />
        <h1 className="text-lg font-bold">LIVE</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap",
              chip === c ? "bg-white text-black" : "bg-chip hover:bg-white/20"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {STREAMS.map((s, i) => (
          <button
            key={i}
            onClick={() => toast("LIVE streaming is a preview-only demo")}
            className="text-left group"
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-card">
              <img
                src={s.img}
                alt={s.title}
                className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
              <span className="absolute top-2 left-2 flex items-center gap-1 bg-accent text-[11px] font-bold px-1.5 py-0.5 rounded animate-live-pulse">
                <Radio size={11} /> LIVE
              </span>
              <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[12px] font-semibold bg-black/50 rounded px-1.5 py-0.5">
                <Eye size={13} /> {formatCount(s.viewers)}
              </span>
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-snug line-clamp-1">{s.title}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Avatar src={s.avatar} name={s.handle} size={20} />
              <span className="text-[12px] text-white/50">{s.handle}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}