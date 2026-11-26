"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useUI } from "@/components/UIProvider";

export function ModerationScanButton() {
  const { toast } = useUI();
  const [scanning, setScanning] = useState(false);

  const runScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const response = await fetch("/api/admin/moderation/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 8, forceAll: true }),
      });
      const data = await response.json();
      if (response.ok) {
        const deleted = (data.recheck?.autoDeleted ?? 0) + (data.oldScan?.autoDeleted ?? 0);
        const checked = (data.recheck?.checked ?? 0) + (data.oldScan?.scanned ?? 0);
        toast(
          deleted > 0
            ? `Scan complete: ${checked} checked, ${deleted} auto-deleted`
            : `Scan complete: ${checked} posts checked, all clear`
        );
        window.location.reload();
      } else {
        toast("Scan failed");
      }
    } catch {
      toast("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <button
      type="button"
      disabled={scanning}
      onClick={runScan}
      className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-[13px] font-bold hover:bg-white/90 disabled:opacity-50"
    >
      {scanning ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <RefreshCw size={14} />
      )}
      <span>{scanning ? "Scanning…" : "Scan old posts now"}</span>
    </button>
  );
}

export default function AdminModerationQueue({ videoId }: { videoId: number }) {
  const { toast } = useUI();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const act = async (action: "approve" | "reject") => {
    if (busy) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/moderation/${videoId}/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        toast(
          action === "approve"
            ? "Post approved and published"
            : "Post permanently deleted from DB & storage"
        );
        window.location.reload();
      } else {
        toast("Action failed");
      }
    } catch {
      toast("Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => act("approve")}
        className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => act("reject")}
        className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
      >
        {busy === "reject" ? "…" : "Delete"}
      </button>
    </div>
  );
}
