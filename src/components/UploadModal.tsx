"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Crop,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { useUI } from "@/components/UIProvider";
import { getViewerHandle } from "@/lib/identity";
import { cn } from "@/lib/utils";

type CameraMode = "10m" | "60s" | "15s" | "PHOTO" | "TEXT";
type Step = "camera" | "preview" | "details";

type MediaDraft = {
  id: string;
  kind: "photo" | "video";
  file?: File;
  remoteUrl?: string;
  coverUrl?: string;
  previewUrl: string;
};

const CAMERA_MODES: CameraMode[] = ["10m", "60s", "15s", "PHOTO", "TEXT"];

const FILTERS = [
  {
    id: "normal",
    name: "Normal",
    css: "none",
    thumb:
      "https://images.pexels.com/photos/698532/pexels-photo-698532.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  },
  {
    id: "sunset",
    name: "Sunset",
    css: "saturate(1.28) contrast(1.06) sepia(0.14)",
    thumb:
      "https://images.pexels.com/videos/28459255/amazing-beach-beach-sunset-beautiful-sunset-28459255.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
  },
  {
    id: "nature",
    name: "Fresh",
    css: "saturate(1.32) brightness(1.04) hue-rotate(-4deg)",
    thumb:
      "https://images.pexels.com/videos/28870671/4k-background-4k-drone-4k-drone-footage-4k-drone-video-28870671.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
  },
  {
    id: "soft",
    name: "Soft Glow",
    css: "brightness(1.08) contrast(0.96) saturate(1.12)",
    thumb:
      "https://images.pexels.com/photos/16869444/pexels-photo-16869444.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  },
  {
    id: "moody",
    name: "Moody",
    css: "contrast(1.18) brightness(0.92) saturate(0.82)",
    thumb:
      "https://images.pexels.com/photos/27544052/pexels-photo-27544052.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
  },
] as const;

const SOUND_PRESETS = [
  "21 - original sound",
  "Midnight Groove – DJ Nova",
  "Kitchen Jazz – Trio Bleu",
  "Neon Nights – VHS Dreams",
  "Ocean Waves – Calm Collective",
];

const STICKERS = ["", "✨", "🔥", "❤️", "🌿", "🎉"];

const SAMPLE_CLIPS = [
  {
    label: "Dance Video",
    kind: "video" as const,
    url: "https://videos.pexels.com/video-files/4753978/4753978-hd_1080_1920_25fps.mp4",
    cover:
      "https://images.pexels.com/videos/4753978/choreography-dance-dancer-dancing-4753978.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  },
  {
    label: "Nature Video",
    kind: "video" as const,
    url: "https://videos.pexels.com/video-files/28870671/12500458_2160_3840_60fps.mp4",
    cover:
      "https://images.pexels.com/videos/28870671/4k-background-4k-drone-4k-drone-footage-4k-drone-video-28870671.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  },
  {
    label: "Sunset Photo",
    kind: "photo" as const,
    url: "https://images.pexels.com/videos/28459255/amazing-beach-beach-sunset-beautiful-sunset-28459255.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    cover:
      "https://images.pexels.com/videos/28459255/amazing-beach-beach-sunset-beautiful-sunset-28459255.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
  },
  {
    label: "Waterfall Photo",
    kind: "photo" as const,
    url: "https://images.pexels.com/videos/36207485/pexels-photo-36207485.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    cover:
      "https://images.pexels.com/videos/36207485/pexels-photo-36207485.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
  },
];

function MusicNoteSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
    </svg>
  );
}

function FlashOffSvg() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4.5 12.5h6.5L10 22l8.5-10.5H12L13 2Z" fill="currentColor" stroke="none" opacity={0.92} />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth={2.2} />
    </svg>
  );
}

function TimerGaugeSvg() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 1-6.36 2.64" />
      <path d="M12 7v5l3 2" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CollageThreePaneSvg() {
  return (
    <svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="12" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function MicBadgeSvg({ muted }: { muted: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5 10.5a7 7 0 0 0 14 0" />
        <line x1="12" y1="17.5" x2="12" y2="21" />
      </svg>
      {muted && (
        <span className="absolute -right-1 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-[#fe2c55] flex items-center justify-center ring-1 ring-black">
          <span className="w-2 h-[1.8px] bg-white rounded-full" />
        </span>
      )}
    </span>
  );
}

function InwardZoomSvg() {
  return (
    <svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="10 5 10 10 5 10" />
      <line x1="4" y1="4" x2="10" y2="10" />
      <polyline points="14 19 14 14 19 14" />
      <line x1="20" y1="20" x2="14" y2="14" />
    </svg>
  );
}

function GearSunSvg() {
  return (
    <svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

function ShareOutlineSvg() {
  return (
    <svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 5V2.8L21.2 9.5 14 16.2V13.5c-5.4 0-8.6 1.7-11 5.2.8-6.4 4.2-10.7 11-11.2V5Z" />
    </svg>
  );
}

function ClipsCardsSvg() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="13" height="15" rx="3" transform="rotate(-8 4 5)" />
      <path d="M17 4.5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
      <polygon points="9.5,10 9.5,15 13.8,12.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StickerSmileySvg() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.5 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h6.5L21 13.5V7a4 4 0 0 0-4-4h-1.5Z" />
      <path d="M14 21v-4.5a2.5 2.5 0 0 1 2.5-2.5H21" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FilterRingsSvg() {
  return (
    <svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8.2" r="4.6" />
      <circle cx="8.5" cy="14.5" r="4.6" />
      <circle cx="15.5" cy="14.5" r="4.6" />
    </svg>
  );
}

function VoiceSparkleSvg() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8.5" y="3" width="6" height="10.5" rx="3" />
      <path d="M5 10.5a6.5 6.5 0 0 0 13 0" />
      <line x1="11.5" y1="17" x2="11.5" y2="21" />
      <path d="M18.5 3v3.2M16.9 4.6h3.2" strokeWidth={1.8} />
    </svg>
  );
}

export default function UploadModal() {
  const { uploadOpen, closeUpload, toast } = useUI();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addPhotoInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

  const [step, setStep] = useState<Step>("camera");
  const [bottomTab, setBottomTab] = useState<"CAMERA" | "CREATE">("CAMERA");
  const [cameraMode, setCameraMode] = useState<CameraMode>("PHOTO");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [timerSec, setTimerSec] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [layoutGrid, setLayoutGrid] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [filterIdx, setFilterIdx] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);

  const [items, setItems] = useState<MediaDraft[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [soundOpen, setSoundOpen] = useState(false);
  const [music, setMusic] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [stickerIdx, setStickerIdx] = useState(0);
  const [cropFit, setCropFit] = useState<"cover" | "contain">("cover");
  const [previewMuted, setPreviewMuted] = useState(false);

  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<"Everyone" | "Friends" | "Only you">("Everyone");
  const [posting, setPosting] = useState(false);
  const [viewerAvatar, setViewerAvatar] = useState<string | null>(null);

  const activeFilter = FILTERS[filterIdx] ?? FILTERS[0];
  const currentItem = items[activeSlide] ?? items[0] ?? null;

  useEffect(() => {
    if (!uploadOpen) return;
    fetch(`/api/users/${getViewerHandle()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.avatarUrl) setViewerAvatar(d.user.avatarUrl);
      })
      .catch(() => {});
  }, [uploadOpen]);

  const stopCameraStream = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!uploadOpen || step !== "camera" || bottomTab !== "CAMERA") {
      stopCameraStream();
      return;
    }
    let cancelled = false;
    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraReady(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: !micMuted,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          await liveVideoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        setCameraReady(false);
      }
    }
    void startCamera();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [uploadOpen, step, bottomTab, facingMode, micMuted, stopCameraStream]);

  const revokeDrafts = useCallback((list: MediaDraft[]) => {
    for (const entry of list) {
      if (entry.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    }
  }, []);

  const resetAll = useCallback(() => {
    stopCameraStream();
    setItems((prev) => {
      revokeDrafts(prev);
      return [];
    });
    setActiveSlide(0);
    setStep("camera");
    setBottomTab("CAMERA");
    setCameraMode("PHOTO");
    setFilterIdx(0);
    setOverlayText("");
    setStickerIdx(0);
    setCropFit("cover");
    setCaption("");
    setMusic("");
    setSoundOpen(false);
    setTextEditorOpen(false);
    setCountdown(null);
  }, [revokeDrafts, stopCameraStream]);

  const handleClose = () => {
    if (posting) return;
    resetAll();
    closeUpload();
  };

  /** Renders a crisp captured photo File from the live camera or viewfinder canvas. */
  const capturePhotoFile = async (): Promise<File> => {
    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1440;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    if (activeFilter.css !== "none") {
      ctx.filter = activeFilter.css;
    }

    const videoEl = liveVideoRef.current;
    if (cameraReady && videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const scale = Math.max(width / vw, height / vh) * (zoomed ? 1.25 : 1);
      const dw = vw * scale;
      const dh = vh * scale;
      ctx.save();
      if (facingMode === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoEl, (width - dw) / 2, (height - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      // Smooth camera viewfinder fallback when no hardware webcam is attached
      const grad = ctx.createLinearGradient(0, 0, width, height);
      if (cameraMode === "TEXT") {
        grad.addColorStop(0, "#1c2541");
        grad.addColorStop(0.5, "#3a506b");
        grad.addColorStop(1, "#0b132b");
      } else {
        grad.addColorStop(0, "#2b2d42");
        grad.addColorStop(0.5, "#3d5a80");
        grad.addColorStop(1, "#1d3557");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(width * 0.75, height * 0.24, 240, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.filter = "none";
    if (overlayText.trim()) {
      ctx.font = "bold 56px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = 14;
      ctx.fillText(overlayText.trim(), width / 2, height / 2);
    }

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", 0.9)
    );
    return new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const performShutterAction = async () => {
    if (cameraMode === "PHOTO" || cameraMode === "TEXT") {
      const photoFile = await capturePhotoFile();
      const url = URL.createObjectURL(photoFile);
      setItems((prev) => {
        revokeDrafts(prev);
        return [{ id: `cap-${Date.now()}`, kind: "photo", file: photoFile, previewUrl: url }];
      });
      setActiveSlide(0);
      if (!music) setMusic("21 - original sound");
      setStep("preview");
      return;
    }

    // Video modes: 15s / 60s / 10m
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (streamRef.current && typeof MediaRecorder !== "undefined") {
      try {
        recordChunksRef.current = [];
        const recorder = new MediaRecorder(streamRef.current);
        recorderRef.current = recorder;
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) recordChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordChunksRef.current, { type: "video/webm" });
          const file = new File([blob], `record-${Date.now()}.webm`, { type: "video/webm" });
          const url = URL.createObjectURL(file);
          setItems((prev) => {
            revokeDrafts(prev);
            return [{ id: `rec-${Date.now()}`, kind: "video", file, previewUrl: url }];
          });
          setActiveSlide(0);
          if (!music) setMusic("21 - original sound");
          setStep("preview");
        };
        recorder.start();
        setRecording(true);
        const maxMs = cameraMode === "15s" ? 15000 : cameraMode === "60s" ? 60000 : 180000;
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, maxMs);
        return;
      } catch {
        /* fallback below if MediaRecorder unsupported */
      }
    }

    // Fallback when headless/no webcam for video mode: capture still or open sample video preview
    const sampleVideo = SAMPLE_CLIPS[0];
    setItems((prev) => {
      revokeDrafts(prev);
      return [
        {
          id: `sample-${Date.now()}`,
          kind: "video",
          remoteUrl: sampleVideo.url,
          coverUrl: sampleVideo.cover,
          previewUrl: sampleVideo.url,
        },
      ];
    });
    setActiveSlide(0);
    if (!music) setMusic("21 - original sound");
    setStep("preview");
  };

  const handleShutterClick = () => {
    if (countdown !== null) return;
    if (timerSec > 0 && !recording) {
      let remaining: number = timerSec;
      setCountdown(remaining);
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(null);
          void performShutterAction();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
      return;
    }
    void performShutterAction();
  };

  const handleFilesSelected = (fileList: FileList | null, append = false) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const videoFile = files.find(
      (f) => f.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(f.name)
    );
    const imageFiles = files.filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|gif)$/i.test(f.name)
    );

    if (videoFile && !append) {
      if (videoFile.size > 150 * 1024 * 1024) {
        toast("Video file too large (max 150MB)");
        return;
      }
      const url = URL.createObjectURL(videoFile);
      setItems((prev) => {
        revokeDrafts(prev);
        return [{ id: `vid-${Date.now()}`, kind: "video", file: videoFile, previewUrl: url }];
      });
      setActiveSlide(0);
      if (!music) setMusic("21 - original sound");
      setStep("preview");
      return;
    }

    if (imageFiles.length > 0) {
      const drafts: MediaDraft[] = [];
      for (const img of imageFiles.slice(0, 10)) {
        if (img.size > 25 * 1024 * 1024) {
          toast("Each photo must be under 25MB");
          continue;
        }
        drafts.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: "photo",
          file: img,
          previewUrl: URL.createObjectURL(img),
        });
      }
      if (drafts.length === 0) return;
      setItems((prev) => {
        if (append && prev.every((p) => p.kind === "photo")) {
          const next = [...prev, ...drafts].slice(0, 10);
          setActiveSlide(next.length - 1);
          return next;
        }
        revokeDrafts(prev);
        setActiveSlide(0);
        return drafts;
      });
      if (!music) setMusic("21 - original sound");
      setStep("preview");
      return;
    }

    toast("Please choose a photo or video file");
  };

  const selectSampleItem = (sample: (typeof SAMPLE_CLIPS)[number]) => {
    setItems((prev) => {
      revokeDrafts(prev);
      return [
        {
          id: `sample-${Date.now()}`,
          kind: sample.kind,
          remoteUrl: sample.url,
          coverUrl: sample.cover,
          previewUrl: sample.url,
        },
      ];
    });
    setActiveSlide(0);
    if (!music) setMusic("21 - original sound");
    setStep("preview");
  };

  /** Bake filter/text/sticker onto a photo File if edits were applied on Stage 2. */
  const preparePhotoFileForUpload = async (draft: MediaDraft): Promise<File | null> => {
    if (!draft.file) return null;
    const hasEdits =
      activeFilter.css !== "none" || Boolean(overlayText.trim()) || Boolean(STICKERS[stickerIdx]);
    if (!hasEdits) return draft.file;

    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = draft.previewUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1080;
      canvas.height = img.naturalHeight || 1440;
      const ctx = canvas.getContext("2d")!;
      if (activeFilter.css !== "none") ctx.filter = activeFilter.css;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";

      if (overlayText.trim()) {
        const fontSize = Math.max(32, Math.round(canvas.width * 0.055));
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 12;
        ctx.fillText(overlayText.trim(), canvas.width / 2, canvas.height * 0.48);
      }
      if (STICKERS[stickerIdx]) {
        const emojiSize = Math.max(48, Math.round(canvas.width * 0.09));
        ctx.font = `${emojiSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(STICKERS[stickerIdx], canvas.width / 2, canvas.height * 0.34);
      }

      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b ?? draft.file!), "image/jpeg", 0.9)
      );
      return new File([blob], draft.file.name.replace(/\.\w+$/, ".jpg"), {
        type: "image/jpeg",
      });
    } catch {
      return draft.file;
    }
  };

  const publishPost = async (asStory = false) => {
    if (items.length === 0 || posting) {
      toast("Capture or upload a photo or video first");
      return;
    }
    setPosting(true);
    try {
      const finalCaption = caption.trim() || (overlayText.trim() ? overlayText.trim() : "");
      const finalSound = music.trim() || "original sound";
      let response: Response;

      const hasLocalFiles = items.some((i) => Boolean(i.file));
      if (hasLocalFiles) {
        const fd = new FormData();
        fd.append("caption", finalCaption);
        fd.append("musicName", finalSound);
        if (items[0].kind === "video" && items[0].file) {
          fd.append("file", items[0].file);
        } else {
          for (const draft of items) {
            const prepared = await preparePhotoFileForUpload(draft);
            if (prepared) fd.append("files", prepared);
          }
        }
        response = await fetch("/api/videos", { method: "POST", body: fd });
      } else {
        const first = items[0];
        const payload =
          first.kind === "photo"
            ? {
                images: items.map((i) => i.remoteUrl ?? i.previewUrl),
                coverUrl: first.coverUrl ?? first.previewUrl,
                caption: finalCaption,
                musicName: finalSound,
              }
            : {
                videoUrl: first.remoteUrl ?? first.previewUrl,
                coverUrl: first.coverUrl ?? null,
                caption: finalCaption,
                musicName: finalSound,
              };
        response = await fetch("/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();
      const mod = data.moderation;

      if (response.status === 202) {
        toast("Temporarily hidden — AI is running a fast re-check now.");
        resetAll();
        closeUpload();
        router.push("/");
        router.refresh();
        return;
      }

      if (!response.ok) {
        toast(mod?.reason ?? data.error ?? "Post could not be published");
        return;
      }

      toast(
        asStory
          ? "Added to Your Story! ✨"
          : items[0].kind === "photo"
            ? "Your photo post is live! 🎉"
            : "Your video is live! 🎉"
      );
      resetAll();
      closeUpload();
      router.push("/");
      router.refresh();
    } catch {
      toast("Upload failed — please try again");
    } finally {
      setPosting(false);
    }
  };

  if (!uploadOpen) return null;

  const leftFilters = [FILTERS[1], FILTERS[2]];
  const rightFilters = [FILTERS[3], FILTERS[4]];
  const soundDisplay = music || "21 - original sound";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Create post"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files, false);
          e.target.value = "";
        }}
      />
      <input
        ref={addPhotoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files, true);
          e.target.value = "";
        }}
      />

      <div className="relative w-full max-w-[460px] h-[100dvh] bg-black flex flex-col overflow-hidden">
        {step === "camera" && (
          <>
            {/* Stage 1: Camera & Upload Screen (Screenshot 2) */}
            <div
              className="relative flex-1 w-full rounded-b-[26px] overflow-hidden bg-[#161823]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files, false);
              }}
            >
              {bottomTab === "CAMERA" ? (
                <>
                  {/* Viewfinder backdrop + Live camera video */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-[#2b3040] via-[#1f2937] to-[#111827]"
                    style={{ filter: activeFilter.css }}
                  />
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      "absolute inset-0 h-full w-full object-cover transition-transform duration-200",
                      !cameraReady && "opacity-0"
                    )}
                    style={{
                      filter: activeFilter.css,
                      transform: `${facingMode === "user" ? "scaleX(-1) " : ""}${zoomed ? "scale(1.22)" : "scale(1)"}`,
                    }}
                  />

                  {cameraMode === "TEXT" && (
                    <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#1b263b] via-[#2c3e50] to-[#0d1b2a] flex items-center justify-center px-8">
                      <textarea
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value.slice(0, 140))}
                        placeholder="Tap to type..."
                        rows={3}
                        className="w-full bg-transparent text-center text-white text-2xl font-bold outline-none placeholder:text-white/45 resize-none"
                      />
                    </div>
                  )}

                  {layoutGrid && (
                    <div className="absolute inset-0 z-10 pointer-events-none grid grid-cols-2">
                      <div className="border-r border-white/35" />
                      <div className="grid grid-rows-2">
                        <div className="border-b border-white/35" />
                        <div />
                      </div>
                    </div>
                  )}

                  {countdown !== null && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 pointer-events-none">
                      <span className="text-7xl font-extrabold text-white drop-shadow-2xl animate-like-pop">
                        {countdown}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                /* CREATE tab: quick sample clips/photos + device gallery picker */
                <div className="absolute inset-0 z-20 flex flex-col justify-center px-5 pt-16 pb-28 overflow-y-auto no-scrollbar bg-[#111]">
                  <p className="text-center text-[15px] font-bold text-white mb-1">
                    Upload Photo or Video
                  </p>
                  <p className="text-center text-[12.5px] text-white/55 mb-4">
                    Choose multiple photos or a video from your device, or try a sample
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-[14px] mb-5 hover:bg-white/90 transition-colors"
                  >
                    Choose Photos or Video from Device
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SAMPLE_CLIPS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => selectSampleItem(s)}
                        className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/15 hover:border-white transition-colors text-left"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.cover} alt={s.label} className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 py-2 text-[12px] font-semibold">
                          {s.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Overlay Bar: Close (X), Add sound pill, Right tool rail */}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="absolute top-4 left-3.5 z-30 w-10 h-10 rounded-full flex items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] hover:bg-black/25"
              >
                <X size={26} strokeWidth={2.1} />
              </button>

              <button
                type="button"
                onClick={() => setSoundOpen(true)}
                className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-black/38 backdrop-blur-md px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-black/50 max-w-[200px]"
              >
                <MusicNoteSvg size={15} />
                <span className="truncate">{music || "Add sound"}</span>
              </button>

              {/* Right Vertical Camera Tool Rail */}
              <div className="absolute top-4 right-3.5 z-30 flex flex-col items-center gap-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === "environment" ? "user" : "environment"))
                  }
                  aria-label="Flip camera"
                  className="p-1 hover:opacity-80"
                >
                  <RefreshCw size={23} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFlashOn((f) => !f);
                    toast(!flashOn ? "Flash on" : "Flash off");
                  }}
                  aria-label="Toggle flash"
                  className="p-1 hover:opacity-80"
                >
                  {flashOn ? <Zap size={24} fill="currentColor" /> : <FlashOffSvg />}
                </button>

                <span className="w-6 h-[1px] bg-white/25 -my-1.5" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => {
                    const next = timerSec === 0 ? 3 : timerSec === 3 ? 10 : 0;
                    setTimerSec(next);
                    toast(next === 0 ? "Timer off" : `Timer ${next}s`);
                  }}
                  aria-label="Timer"
                  className="relative p-1 hover:opacity-80"
                >
                  <TimerGaugeSvg />
                  {timerSec > 0 && (
                    <span className="absolute -bottom-1 -right-1 rounded bg-white text-black text-[9px] font-extrabold px-1 leading-tight">
                      {timerSec}s
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setLayoutGrid((g) => !g)}
                  aria-label="Toggle layout grid"
                  className={cn("p-1 hover:opacity-80", layoutGrid && "text-[#25f4ee]")}
                >
                  <CollageThreePaneSvg />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMicMuted((m) => !m);
                    toast(micMuted ? "Microphone on" : "Microphone muted");
                  }}
                  aria-label="Toggle microphone"
                  className="p-1 hover:opacity-80"
                >
                  <MicBadgeSvg muted={micMuted} />
                </button>

                <button
                  type="button"
                  onClick={() => setZoomed((z) => !z)}
                  aria-label="Toggle zoom"
                  className="p-1 hover:opacity-80"
                >
                  <InwardZoomSvg />
                </button>

                <button
                  type="button"
                  onClick={() => setBottomTab((t) => (t === "CAMERA" ? "CREATE" : "CAMERA"))}
                  aria-label="More camera tools"
                  className="p-1 hover:opacity-80"
                >
                  <ChevronDown size={24} strokeWidth={2.2} />
                </button>
              </div>

              {/* Duration / Mode Selector Row: 10m  60s  15s  PHOTO  TEXT */}
              {bottomTab === "CAMERA" && (
                <>
                  <div
                    className="absolute inset-x-0 bottom-[106px] z-30 flex items-center justify-center gap-4 px-3"
                    role="tablist"
                    aria-label="Capture mode"
                  >
                    {CAMERA_MODES.map((m) => {
                      const active = cameraMode === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setCameraMode(m)}
                          className={cn(
                            "transition-all text-[13.5px] tracking-wide",
                            active
                              ? "bg-white text-black font-bold px-4 py-1.5 rounded-full shadow"
                              : "text-white/95 font-semibold px-1.5 py-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]"
                          )}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>

                  {/* Shutter Button + Circular Filter Thumbnails Row */}
                  <div className="absolute inset-x-0 bottom-[16px] z-30 flex items-center justify-center gap-3.5 px-2">
                    {leftFilters.map((f) => {
                      const idx = FILTERS.findIndex((x) => x.id === f.id);
                      const selected = filterIdx === idx;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setFilterIdx(selected ? 0 : idx);
                            toast(selected ? "Filter: Normal" : `Filter: ${f.name}`);
                          }}
                          aria-label={`Filter ${f.name}`}
                          className={cn(
                            "w-[52px] h-[52px] rounded-full overflow-hidden shrink-0 border transition-transform",
                            selected ? "border-2 border-white scale-105" : "border-white/25 opacity-90"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.thumb} alt={f.name} className="h-full w-full object-cover" />
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleShutterClick}
                      aria-label="Capture"
                      className="w-[78px] h-[78px] rounded-full border-[4px] border-white flex items-center justify-center shrink-0 shadow-lg active:scale-95 transition-transform"
                    >
                      <span
                        className={cn(
                          "transition-all",
                          recording
                            ? "w-7 h-7 rounded-md bg-[#fe2c55]"
                            : cameraMode === "10m" || cameraMode === "60s" || cameraMode === "15s"
                              ? "w-[64px] h-[64px] rounded-full bg-white ring-2 ring-inset ring-black/10"
                              : "w-[64px] h-[64px] rounded-full bg-white"
                        )}
                      />
                    </button>

                    {rightFilters.map((f) => {
                      const idx = FILTERS.findIndex((x) => x.id === f.id);
                      const selected = filterIdx === idx;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setFilterIdx(selected ? 0 : idx);
                            toast(selected ? "Filter: Normal" : `Filter: ${f.name}`);
                          }}
                          aria-label={`Filter ${f.name}`}
                          className={cn(
                            "w-[52px] h-[52px] rounded-full overflow-hidden shrink-0 border transition-transform",
                            selected ? "border-2 border-white scale-105" : "border-white/25 opacity-90"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.thumb} alt={f.name} className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Bottom Black Bar: Gallery Upload Stack + CAMERA centered under shutter + CREATE */}
            <div className="relative h-[68px] w-full bg-black px-5 flex items-center shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload from gallery"
                className="relative flex items-center group"
              >
                <span className="w-[42px] h-[42px] rounded-[9px] border-[1.8px] border-white overflow-hidden block bg-[#1f2937] relative z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={FILTERS[2].thumb}
                    alt="Gallery"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span
                  className="w-[7px] h-[34px] -ml-1 rounded-r-[6px] bg-white/45 block"
                  aria-hidden="true"
                />
              </button>

              <div className="absolute left-1/2 -translate-x-[34px] flex items-center gap-7">
                <button
                  type="button"
                  onClick={() => setBottomTab("CAMERA")}
                  className={cn(
                    "text-[14px] tracking-wider transition-colors",
                    bottomTab === "CAMERA"
                      ? "font-extrabold text-white"
                      : "font-semibold text-[#8a8a8a]"
                  )}
                >
                  CAMERA
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab("CREATE")}
                  className={cn(
                    "text-[14px] tracking-wider transition-colors",
                    bottomTab === "CREATE"
                      ? "font-extrabold text-white"
                      : "font-semibold text-[#8a8a8a]"
                  )}
                >
                  CREATE
                </button>
              </div>
            </div>
          </>
        )}

        {step === "preview" && currentItem && (
          <>
            {/* Stage 2: Post-Capture / Post-Upload Preview & Editor (Screenshot 3) */}
            <div className="relative flex-1 w-full rounded-b-[26px] overflow-hidden bg-[#121212]">
              {currentItem.kind === "video" ? (
                <video
                  key={currentItem.previewUrl}
                  src={currentItem.previewUrl}
                  poster={currentItem.coverUrl}
                  autoPlay
                  loop
                  playsInline
                  muted={previewMuted}
                  className={cn(
                    "absolute inset-0 h-full w-full",
                    cropFit === "cover" ? "object-cover" : "object-contain bg-black"
                  )}
                  style={{ filter: activeFilter.css }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentItem.previewUrl}
                  alt="Selected media preview"
                  className={cn(
                    "absolute inset-0 h-full w-full",
                    cropFit === "cover" ? "object-cover" : "object-contain bg-black"
                  )}
                  style={{ filter: activeFilter.css }}
                />
              )}

              {/* Sticker & Aa text overlays on preview */}
              {(overlayText.trim() || STICKERS[stickerIdx]) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
                  {STICKERS[stickerIdx] && (
                    <span className="text-5xl mb-2 drop-shadow-lg">{STICKERS[stickerIdx]}</span>
                  )}
                  {overlayText.trim() && (
                    <p className="text-2xl font-extrabold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)] break-words max-w-full">
                      {overlayText}
                    </p>
                  )}
                </div>
              )}

              {/* Top Overlay: < Back chevron + Sound Pill (♪ 21 - original so... | ✕) */}
              <button
                type="button"
                onClick={() => setStep("camera")}
                aria-label="Back to camera"
                className="absolute top-4 left-3 z-30 w-10 h-10 rounded-full flex items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] hover:bg-black/25"
              >
                <ChevronLeft size={28} strokeWidth={2.2} />
              </button>

              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center rounded-full bg-black/42 backdrop-blur-md pl-3.5 pr-2.5 py-2 text-white shadow-sm max-w-[220px]">
                <button
                  type="button"
                  onClick={() => setSoundOpen(true)}
                  className="flex items-center gap-1.5 min-w-0 pr-2.5 text-[13.5px] font-semibold"
                >
                  <MusicNoteSvg size={15} />
                  <span className="truncate max-w-[128px]">{soundDisplay}</span>
                </button>
                <span className="h-3.5 w-[1px] bg-white/30 shrink-0" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setMusic("original sound")}
                  aria-label="Clear sound"
                  className="pl-2 text-white/90 hover:text-white shrink-0"
                >
                  <X size={16} strokeWidth={2.2} />
                </button>
              </div>

              {/* Right Vertical Editor Tool Rail (exact Screenshot 3 icons) */}
              <div className="absolute top-4 right-3.5 z-30 flex flex-col items-center gap-4 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={() => {
                    const next =
                      privacy === "Everyone"
                        ? "Friends"
                        : privacy === "Friends"
                          ? "Only you"
                          : "Everyone";
                    setPrivacy(next);
                    toast(`Privacy: ${next}`);
                  }}
                  aria-label="Privacy settings"
                  className="p-1 hover:opacity-80"
                >
                  <GearSunSvg />
                </button>

                <button
                  type="button"
                  onClick={() => toast("Draft ready to share")}
                  aria-label="Share options"
                  className="p-1 hover:opacity-80"
                >
                  <ShareOutlineSvg />
                </button>

                <span className="w-6 h-[1px] bg-white/25 -my-1" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() =>
                    currentItem.kind === "photo"
                      ? addPhotoInputRef.current?.click()
                      : fileInputRef.current?.click()
                  }
                  aria-label="Add clip or photo"
                  className="p-1 hover:opacity-80"
                >
                  <ClipsCardsSvg />
                </button>

                <button
                  type="button"
                  onClick={() => setTextEditorOpen((v) => !v)}
                  aria-label="Add text overlay"
                  className="p-1 text-[20px] font-extrabold leading-none tracking-tight hover:opacity-80"
                >
                  Aa
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = (stickerIdx + 1) % STICKERS.length;
                    setStickerIdx(next);
                    toast(STICKERS[next] ? `Sticker ${STICKERS[next]}` : "Sticker removed");
                  }}
                  aria-label="Add sticker"
                  className="p-1 hover:opacity-80"
                >
                  <StickerSmileySvg />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = (filterIdx + 1) % FILTERS.length;
                    setFilterIdx(next);
                    toast(`Filter: ${FILTERS[next].name}`);
                  }}
                  aria-label="Cycle filter"
                  className="p-1 hover:opacity-80"
                >
                  <FilterRingsSvg />
                </button>

                <button
                  type="button"
                  onClick={() => setCropFit((c) => (c === "cover" ? "contain" : "cover"))}
                  aria-label="Toggle crop"
                  className="p-1 hover:opacity-80"
                >
                  <Crop size={23} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewMuted((m) => !m);
                    toast(previewMuted ? "Audio unmuted" : "Audio muted");
                  }}
                  aria-label="Audio options"
                  className="p-1 hover:opacity-80"
                >
                  <VoiceSparkleSvg />
                </button>

                <button
                  type="button"
                  onClick={() => setSoundOpen(true)}
                  aria-label="More editor tools"
                  className="p-1 hover:opacity-80"
                >
                  <ChevronDown size={23} strokeWidth={2.2} />
                </button>
              </div>

              {/* Inline Aa Text Overlay Editor */}
              {textEditorOpen && (
                <div className="absolute inset-x-4 top-16 z-40 rounded-2xl bg-black/75 backdrop-blur-md p-3.5 border border-white/15">
                  <div className="flex items-center gap-2">
                    <input
                      value={overlayText}
                      onChange={(e) => setOverlayText(e.target.value.slice(0, 120))}
                      placeholder="Type text on your post..."
                      autoFocus
                      className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/40"
                    />
                    <button
                      type="button"
                      onClick={() => setTextEditorOpen(false)}
                      className="px-3.5 py-2 rounded-lg bg-white text-black text-[13px] font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom-Center Thumbnail Strip inside Preview Card (Screenshot 3) */}
              <div className="absolute inset-x-0 bottom-4 z-30 flex flex-col items-center pointer-events-none">
                <div className="pointer-events-auto mb-2 text-white/85 drop-shadow">
                  <ChevronDown size={20} strokeWidth={2.4} />
                </div>
                <div className="pointer-events-auto flex items-center justify-center gap-2.5 px-4 max-w-full overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Replace media"
                    className="w-[40px] h-[40px] rounded-[10px] bg-white/14 backdrop-blur-md flex items-center justify-center text-white/85 shrink-0 hover:bg-white/22"
                  >
                    <LayoutGrid size={17} strokeWidth={2} />
                  </button>

                  {items.map((entry, idx) => {
                    const selected = idx === activeSlide;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setActiveSlide(idx)}
                        aria-label={`Slide ${idx + 1}`}
                        className={cn(
                          "relative w-[48px] h-[48px] rounded-[11px] overflow-hidden shrink-0 transition-all",
                          selected
                            ? "border-2 border-white shadow-lg"
                            : "border border-white/25 opacity-80"
                        )}
                      >
                        {entry.kind === "video" ? (
                          <video
                            src={entry.previewUrl}
                            poster={entry.coverUrl}
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.previewUrl}
                            alt={`Slide ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      currentItem.kind === "photo"
                        ? addPhotoInputRef.current?.click()
                        : fileInputRef.current?.click()
                    }
                    aria-label="Add more photos"
                    className="w-[40px] h-[40px] rounded-[10px] bg-white/18 backdrop-blur-md flex items-center justify-center text-white shrink-0 hover:bg-white/28"
                  >
                    <Plus size={20} strokeWidth={2.3} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Black Bar: [Your Story] white pill + [Next] pink/red pill */}
            <div className="h-[74px] w-full bg-black px-3.5 flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={posting}
                onClick={() => void publishPost(true)}
                className="flex-1 h-[48px] rounded-full bg-white text-black font-bold text-[15px] flex items-center justify-center gap-2.5 active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                <span className="w-[30px] h-[30px] rounded-full p-[2px] bg-gradient-to-tr from-[#25f4ee] via-[#3898ed] to-[#25f4ee] shrink-0 block">
                  {viewerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewerAvatar}
                      alt=""
                      className="h-full w-full rounded-full object-cover bg-black"
                    />
                  ) : (
                    <span className="h-full w-full rounded-full bg-black text-white text-[11px] flex items-center justify-center font-bold">
                      A
                    </span>
                  )}
                </span>
                <span>{posting ? "Posting…" : "Your Story"}</span>
              </button>

              <button
                type="button"
                disabled={posting}
                onClick={() => setStep("details")}
                className="flex-1 h-[48px] rounded-full bg-[#fe2c55] hover:bg-[#ef2950] text-white font-bold text-[15px] flex items-center justify-center active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === "details" && currentItem && (
          /* Stage 3: Final Caption / Hashtags / Post Screen after tapping Next */
          <div className="flex-1 flex flex-col bg-black text-white overflow-y-auto">
            <header className="h-14 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setStep("preview")}
                aria-label="Back to preview"
                className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10"
              >
                <ChevronLeft size={26} />
              </button>
              <h2 className="text-[16px] font-bold">New post</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="p-1.5 -mr-1.5 rounded-full hover:bg-white/10"
              >
                <X size={21} />
              </button>
            </header>

            <div className="p-4 space-y-5 flex-1">
              <div className="flex gap-3.5 items-start">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 300))}
                  rows={4}
                  placeholder="Write a caption and add #hashtags..."
                  className="flex-1 bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-white/40 resize-none"
                />
                <div className="relative w-[84px] aspect-[3/4] rounded-xl overflow-hidden bg-[#181818] border border-white/10 shrink-0">
                  {currentItem.kind === "video" ? (
                    <video
                      src={currentItem.previewUrl}
                      poster={currentItem.coverUrl}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentItem.previewUrl}
                      alt="Cover"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {items.length > 1 && (
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">
                      {items.length} photos
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[12px] text-white/40 border-b border-white/10 pb-3">
                <div className="flex gap-2">
                  {["#fyp", "#photo", "#viral"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setCaption((c) =>
                          c.includes(tag) ? c : `${c}${c && !c.endsWith(" ") ? " " : ""}${tag} `.slice(0, 300)
                        )
                      }
                      className="px-2.5 py-1 rounded-md bg-white/10 text-white/85 font-semibold"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <span>{caption.length}/300</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[12.5px] font-semibold text-white/65 mb-1.5">
                    Sound
                  </label>
                  <input
                    value={music}
                    onChange={(e) => setMusic(e.target.value.slice(0, 120))}
                    placeholder="original sound"
                    className="w-full rounded-xl bg-[#161616] border border-white/10 px-3.5 py-2.5 text-[14px] outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-white/65 mb-1.5">
                    Who can view this post
                  </label>
                  <select
                    value={privacy}
                    onChange={(e) =>
                      setPrivacy(e.target.value as "Everyone" | "Friends" | "Only you")
                    }
                    className="w-full rounded-xl bg-[#161616] border border-white/10 px-3.5 py-2.5 text-[14px] outline-none"
                  >
                    <option value="Everyone">Everyone</option>
                    <option value="Friends">Friends</option>
                    <option value="Only you">Only you</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex gap-3 shrink-0 bg-black">
              <button
                type="button"
                disabled={posting}
                onClick={() => setStep("preview")}
                className="flex-1 h-[48px] rounded-full bg-[#1f1f1f] text-white font-bold text-[15px]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={posting}
                onClick={() => void publishPost(false)}
                className="flex-1 h-[48px] rounded-full bg-[#fe2c55] hover:bg-[#ef2950] text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {posting && <Loader2 size={17} className="animate-spin" />}
                {posting ? "Checking & Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}

        {/* Sound Picker Sheet */}
        {soundOpen && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
            <div className="w-full rounded-t-2xl bg-[#161616] border-t border-white/10 p-4 space-y-3 animate-sheet-up">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[15px]">Choose sound</h3>
                <button
                  type="button"
                  onClick={() => setSoundOpen(false)}
                  aria-label="Close sound picker"
                  className="p-1 rounded-full hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
              <input
                value={music}
                onChange={(e) => setMusic(e.target.value.slice(0, 120))}
                placeholder="Type custom sound name..."
                className="w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-[14px] outline-none placeholder:text-white/40"
              />
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {SOUND_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setMusic(s);
                      setSoundOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left text-[13.5px] font-medium"
                  >
                    <MusicNoteSvg size={15} />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
