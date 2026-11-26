"use client";

import { Send } from "lucide-react";
import { useUI } from "@/components/UIProvider";

export default function MessagesPage() {
  const { toast } = useUI();
  return (
    <div className="sx-viewport flex flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-chip flex items-center justify-center">
        <Send size={34} className="text-white/60" />
      </div>
      <h1 className="text-xl font-bold mt-2">Messages</h1>
      <p className="text-white/45 text-sm max-w-xs">
        Messages you send and receive will appear here. Direct messaging is coming soon to this
        demo.
      </p>
      <button
        onClick={() => toast("Direct messages are coming soon")}
        className="mt-3 px-6 py-2.5 rounded-full bg-accent hover:bg-[#ef2950] font-semibold text-sm"
      >
        Start a conversation
      </button>
    </div>
  );
}