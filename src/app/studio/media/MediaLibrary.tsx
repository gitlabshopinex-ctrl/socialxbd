"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Film, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useUI } from "@/components/UIProvider";
import { cn } from "@/lib/utils";

const MAX_BYTES = 200 * 1024 * 1024;

type Asset = {
  id: string;
  assetId?: number;
  url: string;
  fileName?: string;
  mimeType?: string;
  kind?: string;
  sizeBytes?: number;
  provider?: string;
  createdAt?: string;
};

type ListPayload = {
  provider: string;
  configured: boolean;
  tracked: Asset[];
  remote: Asset[];
  remoteError: string | null;
};

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaLibrary() {
  const { toast } = useUI();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      const payload = (await response.json()) as ListPayload;
      if (!response.ok) throw new Error("Listing failed");
      setData(payload);
    } catch {
      toast("Could not load media library");
      setData({ provider: "local", configured: false, tracked: [], remote: [], remoteError: null });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = (file: File | undefined | null) => {
    if (!file) return;
    const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!isMedia) {
      toast("Only images and videos are allowed");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast("File is larger than the 200 MB limit");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          toast(`Uploaded ${file.name} (${formatSize(file.size)})`);
          void load();
        } else {
          toast(payload.error ?? "Upload failed");
        }
      } catch {
        toast("Upload failed");
      }
      if (inputRef.current) inputRef.current.value = "";
    };
    xhr.onerror = () => {
      setProgress(null);
      toast("Upload failed — network error");
    };
    xhr.send(form);
  };

  const remove = async (asset: Asset) => {
    if (busyId) return;
    setBusyId(asset.id);
    try {
      const response = await fetch(`/api/media?id=${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(payload.error ?? "Delete failed");
        return;
      }
      toast("Media deleted from storage");
      setData((previous) =>
        previous
          ? {
              ...previous,
              tracked: previous.tracked.filter((item) => item.id !== asset.id),
              remote: previous.remote.filter((item) => item.id !== asset.id),
            }
          : previous
      );
    } catch {
      toast("Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const items = (() => {
    const map = new Map<string, Asset>();
    for (const asset of data?.tracked ?? []) map.set(asset.id, asset);
    for (const asset of data?.remote ?? []) if (!map.has(asset.id)) map.set(asset.id, asset);
    return [...map.values()];
  })();

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">Upload media</h2>
        <span className="rounded-full bg-chip px-3 py-1 text-[11.5px] font-semibold text-white/60">
          {data?.provider === "shopinex" ? "Shopinex API" : "Local storage"} · max 200 MB
        </span>
      </div>

      <label
        htmlFor="studio-media-input"
        className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-[#0b0b0b] px-6 py-10 text-center cursor-pointer hover:border-accent/60 transition-colors"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          upload(event.dataTransfer.files?.[0]);
        }}
      >
        <Upload size={30} className="text-white/35" />
        <p className="text-[14px] font-semibold">Choose an image or video</p>
        <p className="text-[12px] text-white/45">or drag and drop — images & videos up to 200 MB</p>
        <input
          id="studio-media-input"
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => upload(event.target.files?.[0])}
        />
      </label>

      {progress !== null && (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-[12px] text-white/60">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Uploaded media ({items.length})</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[12px] font-semibold text-white/55 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/8 bg-[#0b0b0b] p-8 text-center text-[13px] text-white/45">
          No media uploaded yet.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((asset) => {
            const isVideo = asset.kind === "video" || asset.mimeType?.startsWith("video/");
            return (
              <li
                key={asset.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0b]"
              >
                <div className="relative aspect-[4/3] bg-black">
                  {isVideo ? (
                    <video
                      src={asset.url}
                      className="h-full w-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={asset.fileName ?? "Media"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    {isVideo ? <Film size={11} /> : <ImageIcon size={11} />}
                    {isVideo ? "video" : "image"}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-[12px] font-semibold text-white/85">
                    {asset.fileName || asset.id}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {formatSize(asset.sizeBytes)} · {asset.provider ?? "local"}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <a
                      href={`/api/media/download?id=${encodeURIComponent(asset.id)}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-chip px-2 py-1.5 text-[11.5px] font-semibold hover:bg-white/20"
                    >
                      <Download size={13} /> Download
                    </a>
                    <button
                      type="button"
                      disabled={busyId === asset.id}
                      onClick={() => void remove(asset)}
                      aria-label={`Delete ${asset.fileName ?? asset.id}`}
                      className={cn(
                        "rounded-lg bg-accent/15 px-2 py-1.5 text-accent hover:bg-accent/25",
                        busyId === asset.id && "opacity-50"
                      )}
                    >
                      {busyId === asset.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data?.remoteError && (
        <p className="mt-4 text-[12px] text-amber-300/80">Storage listing: {data.remoteError}</p>
      )}
    </section>
  );
}
