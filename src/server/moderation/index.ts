import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import tf from "@tensorflow/tfjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { moderationLogs, users, videos } from "@/db/schema";
import {
  permanentlyDeletePostAndStorage,
  resolveLocalUploadPath,
} from "@/server/storage";

export type ModerationVerdict = "approved" | "rejected" | "hidden_recheck";

export type ModerationResult = {
  verdict: ModerationVerdict;
  reason: string;
  provider: string;
  durationMs: number;
  details: {
    textScore: number | null;
    imageScore: number | null;
    textVerdict: string;
    imageVerdict: string;
    textMatches: string[];
    linksChecked: number;
    framesAnalyzed: number;
    stageNotes: string[];
    deep: boolean;
  };
};

export type ModerationInput = {
  caption: string;
  musicName?: string | null;
  coverUrl?: string | null;
  remoteImageUrls?: string[];
  videoFilePath?: string | null;
  imageFilePaths?: string[];
  deep?: boolean;
};

type LoadedNsfwModel = {
  classify: (
    img: unknown,
    topk?: number
  ) => Promise<Array<{ className: string; probability: number }>>;
  dispose: () => void;
};

type ToxicityFilter = {
  find: (text: string) => Array<{ term: string; tier: number }>;
  build?: () => void;
};

const MODEL_NAME = "MobileNetV2Mid";

const globalMod = globalThis as typeof globalThis & {
  __sxNsfwModelPromise?: Promise<LoadedNsfwModel>;
  __sxNsfwModelReady?: boolean;
  __sxToxicityDefault?: ToxicityFilter;
  __sxToxicityStrict?: ToxicityFilter;
};

async function loadNsfwModel(): Promise<LoadedNsfwModel> {
  const mod = await import("nsfwjs");
  const nsfw =
    (
      mod as {
        default?: { load: (name: string, options?: Record<string, unknown>) => Promise<unknown> };
      }
    ).default ??
    (mod as { load: (name: string, options?: Record<string, unknown>) => Promise<unknown> });
  const model = (await nsfw.load(MODEL_NAME, { disableWarnings: true })) as LoadedNsfwModel;
  globalMod.__sxNsfwModelReady = true;
  return model;
}

async function getNsfwModel(): Promise<LoadedNsfwModel> {
  if (!globalMod.__sxNsfwModelPromise) {
    globalMod.__sxNsfwModelPromise = loadNsfwModel().catch((err) => {
      globalMod.__sxNsfwModelPromise = undefined;
      globalMod.__sxNsfwModelReady = false;
      throw err;
    });
  }
  return globalMod.__sxNsfwModelPromise;
}

async function getToxicityFilter(strict = false): Promise<ToxicityFilter> {
  if (strict && globalMod.__sxToxicityStrict) return globalMod.__sxToxicityStrict;
  if (!strict && globalMod.__sxToxicityDefault) return globalMod.__sxToxicityDefault;
  const { Toxicity } = await import("toxicity");
  const instance = new Toxicity({ strict }) as ToxicityFilter;
  instance.build?.();
  if (strict) globalMod.__sxToxicityStrict = instance;
  else globalMod.__sxToxicityDefault = instance;
  return instance;
}

export function isModerationModelWarmed(): boolean {
  return Boolean(globalMod.__sxNsfwModelReady);
}

/** Pre-warms open-source AI models in memory at server boot so uploads moderate quickly. */
export async function warmModerationModels(): Promise<void> {
  try {
    await Promise.all([getNsfwModel(), getToxicityFilter(false)]);
    // Warm up TensorFlow CPU kernels with a tiny dummy tensor so first upload is instant.
    const model = await getNsfwModel();
    const dummy = tf.zeros([32, 32, 3], "int32");
    try {
      await model.classify(dummy, 5);
    } finally {
      dummy.dispose();
    }
  } catch (err) {
    console.error("[moderation] model warm-up warning:", err);
  }
}

/** Decode an image buffer and run the free open-source NSFW classifier (nsfwjs + tfjs). */
async function classifyImageBuffer(buffer: Buffer) {
  const model = await getNsfwModel();
  const normalized = await sharp(buffer)
    .rotate()
    .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = normalized.info;
  if (!width || !height) throw new Error("Invalid image: missing dimensions");
  const image = tf.tensor3d(new Uint8Array(normalized.data), [height, width, 3], "int32");
  try {
    return await model.classify(image, 5);
  } finally {
    image.dispose();
  }
}

const UNSAFE_CLASSES = new Set(["Porn", "Hentai"]);
const BORDERLINE_CLASSES = new Set(["Sexy"]);

async function classifyOneImage(buffer: Buffer, stageNotes: string[], deep = false) {
  try {
    const passes: Array<Array<{ className: string; probability: number }>> = [];
    passes.push(await classifyImageBuffer(buffer));

    if (deep) {
      // Deep recheck also inspects the center 70% crop to catch embedded/bordered explicit content.
      try {
        const meta = await sharp(buffer).metadata();
        if (meta.width && meta.height && meta.width >= 100 && meta.height >= 100) {
          const cw = Math.round(meta.width * 0.7);
          const ch = Math.round(meta.height * 0.7);
          const left = Math.round((meta.width - cw) / 2);
          const top = Math.round((meta.height - ch) / 2);
          const cropBuf = await sharp(buffer)
            .extract({ left, top, width: cw, height: ch })
            .png()
            .toBuffer();
          passes.push(await classifyImageBuffer(cropBuf));
        }
      } catch {
        /* ignore crop failure */
      }
    }

    let worstExplicit = 0;
    let worstSexy = 0;
    let topLabel = "Neutral";
    let topProb = 0;

    for (const classes of passes) {
      const top = classes[0];
      if (top && top.probability > topProb) {
        topLabel = top.className;
        topProb = top.probability;
      }
      const pornProb = classes.find((c) => c.className === "Porn")?.probability ?? 0;
      const hentaiProb = classes.find((c) => c.className === "Hentai")?.probability ?? 0;
      const sexyProb = classes.find((c) => c.className === "Sexy")?.probability ?? 0;
      worstExplicit = Math.max(worstExplicit, pornProb, hentaiProb, pornProb + hentaiProb);
      worstSexy = Math.max(worstSexy, sexyProb);

      const explicitFlag =
        pornProb >= 0.45 ||
        hentaiProb >= 0.5 ||
        pornProb + hentaiProb >= 0.52 ||
        (deep && sexyProb >= 0.78);

      if (explicitFlag) {
        stageNotes.push(
          `explicit visual detected (${top?.className ?? "Porn"} ${(
            Math.max(pornProb, hentaiProb, sexyProb) * 100
          ).toFixed(1)}%)`
        );
        return {
          verdict: "flagged" as const,
          score: Math.min(1, Math.max(worstExplicit, worstSexy)),
          classes,
        };
      }
    }

    const unsureFlag =
      worstSexy >= 0.42 ||
      worstExplicit >= 0.22 ||
      passes.some((cls) =>
        cls.some((c) => BORDERLINE_CLASSES.has(c.className) && c.probability >= 0.42)
      );

    if (unsureFlag) {
      stageNotes.push(
        `borderline visual requires recheck (${topLabel} ${(topProb * 100).toFixed(1)}%)`
      );
      return {
        verdict: "unsure" as const,
        score: Math.min(1, Math.max(worstExplicit, worstSexy)),
        classes: passes[0],
      };
    }

    stageNotes.push(`safe visual "${topLabel}" (${(topProb * 100).toFixed(1)}%)`);
    return {
      verdict: "pass" as const,
      score: Math.min(1, worstExplicit),
      classes: passes[0],
    };
  } catch (err) {
    stageNotes.push(
      `image classification unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
    return { verdict: "unsure" as const, score: null, classes: null };
  }
}

/** Download a remote cover/image URL safely (https + public host, limited size). */
async function fetchImage(url: string, stageNotes: string[]): Promise<Buffer | null> {
  const scheme = url.toLowerCase().trim();
  if (!scheme.startsWith("https://") && !scheme.startsWith("http://")) {
    stageNotes.push("image URL protocol not allowed");
    return null;
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    stageNotes.push("invalid image URL");
    return null;
  }
  if (isBlockedHost(host)) {
    stageNotes.push(`image host "${host}" is not public`);
    return null;
  }
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!response.ok || !contentType.startsWith("image/")) {
      stageNotes.push(`image not fetchable (${response.status}, ${contentType || "unknown type"})`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 15 * 1024 * 1024) {
      stageNotes.push("image too large");
      return null;
    }
    return buffer;
  } catch (err) {
    stageNotes.push(`image fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host)) return true;
  if (/^0\.0\.0\.0$/.test(host)) return true;
  if (/^::1$|^fc00:/i.test(host) || /^fd/i.test(host)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && !isPublicIPv4(host)) return true;
  return false;
}

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 127) return false;
  if (a === 10 || (a === 172 && b >= 16 && b <= 31)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a >= 224) return false;
  return true;
}

// ---------- Text & Link Moderation ----------

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

const BLOCKED_ADULT_DOMAINS = [
  "pornhub",
  "xvideos",
  "xnxx",
  "redtube",
  "xhamster",
  "onlyfans",
  "chaturbate",
  "brazzers",
  "youporn",
  "hentaihaven",
  "rule34",
];

// Explicit sexual/obscene terms (English & Bangla) that should always trigger auto-deletion
const EXPLICIT_TERM_PATTERNS: RegExp[] = [
  /\b(porn|porno|pornography|xxx|nsfw\s*leaks?|nude\s*video|nudes?\s*link|sex\s*video|hentai|blowjob|handjob|camgirl|onlyfans\s*leak)\b/i,
  /(অশ্লীল\s*ভিডিও|পর্ন|পর্ণ|সেক্স\s*ভিডিও|নগ্ন\s*ছবি|নগ্ন\s*ভিডিও|চটি\s*গল্প)/i,
];

function extractUrls(text: string) {
  const found = text.match(URL_RE) ?? [];
  return found.map((u) => u.replace(/[.,;:)\]]+$/, ""));
}

async function classifyText(text: string, stageNotes: string[], deep = false) {
  if (!text?.trim()) {
    return { verdict: "pass" as const, score: 0, matches: [] as string[], linksChecked: 0 };
  }

  // 1. Check URLs for adult/unsafe domains or private/malicious hosts
  const urls = extractUrls(text);
  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      stageNotes.push(`unparseable link "${url}"`);
      return { verdict: "unsure" as const, score: 0.6, matches: [] as string[], linksChecked: urls.length };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      stageNotes.push(`disallowed link protocol "${parsed.protocol}"`);
      return { verdict: "flagged" as const, score: 0.95, matches: [parsed.protocol], linksChecked: urls.length };
    }
    const lowerHost = parsed.hostname.toLowerCase();
    if (BLOCKED_ADULT_DOMAINS.some((domain) => lowerHost.includes(domain))) {
      stageNotes.push(`prohibited adult link "${lowerHost}"`);
      return { verdict: "flagged" as const, score: 0.98, matches: [lowerHost], linksChecked: urls.length };
    }
    if (isBlockedHost(parsed.hostname)) {
      stageNotes.push(`link host "${parsed.hostname}" is not public`);
      return { verdict: "unsure" as const, score: 0.6, matches: [] as string[], linksChecked: urls.length };
    }
  }

  // 2. Check explicit sexual/obscene terms (English & Bangla)
  for (const pattern of EXPLICIT_TERM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      stageNotes.push(`explicit prohibited content detected: "${match[0]}"`);
      return { verdict: "flagged" as const, score: 0.96, matches: [match[0]], linksChecked: urls.length };
    }
  }

  // 3. Open-source Toxicity Aho-Corasick evasion-resistant profanity/slur detector
  try {
    const filter = await getToxicityFilter(deep);
    const matches = filter.find(text);
    const tierOne = matches.filter((m) => m.tier === 1);
    const tierTwo = matches.filter((m) => m.tier === 2);
    const matchedTerms = [...new Set(tierOne.map((m) => m.term))];
    if (tierOne.length > 0) {
      stageNotes.push(`prohibited language: ${matchedTerms.slice(0, 5).join(", ")}`);
      return { verdict: "flagged" as const, score: 0.95, matches: matchedTerms, linksChecked: urls.length };
    }
    if (tierTwo.length > 0) {
      const mildTerms = [...new Set(tierTwo.map((m) => m.term))];
      stageNotes.push(`borderline language for recheck: ${mildTerms.slice(0, 3).join(", ")}`);
      return {
        verdict: "unsure" as const,
        score: 0.45,
        matches: mildTerms,
        linksChecked: urls.length,
      };
    }
    return { verdict: "pass" as const, score: 0, matches: [] as string[], linksChecked: urls.length };
  } catch (err) {
    stageNotes.push(
      `text classifier unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
    return { verdict: "unsure" as const, score: null, matches: [] as string[], linksChecked: urls.length };
  }
}

// ---------- Video Frame Extraction ----------

function execFileAsync(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 45000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr }));
      else resolve(stdout);
    });
  });
}

async function getVideoDuration(filePath: string, ffmpeg: string): Promise<number | null> {
  const ffprobe = ffmpeg.replace(/ffmpeg(\.exe)?$/, "ffprobe");
  try {
    const out = await execFileAsync(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const seconds = Number(out.trim());
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  } catch {
    /* fallback to coarse offsets */
  }
  return null;
}

function ffmpegFor(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpeg = require("ffmpeg-static") as string;
    return ffmpeg;
  } catch {
    return null;
  }
}

export async function extractVideoCover(
  videoFilePath: string,
  outputFilePath: string
): Promise<boolean> {
  const ffmpeg = ffmpegFor();
  if (!ffmpeg) return false;
  for (const ss of ["0.4", "0.0"]) {
    try {
      await execFileAsync(ffmpeg, [
        "-y",
        "-ss",
        ss,
        "-i",
        videoFilePath,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        outputFilePath,
      ]);
      const stat = await fs.stat(outputFilePath);
      if (stat.size > 0) return true;
    } catch {
      /* try fallback timestamp */
    }
  }
  return false;
}

async function sampleVideoFrames(
  filePath: string,
  deep = false
): Promise<Array<{ buffer: Buffer; index: number }>> {
  const ffmpeg = ffmpegFor();
  if (!ffmpeg) throw new Error("ffmpeg unavailable");
  const duration = await getVideoDuration(filePath, ffmpeg);
  const percentages = deep ? [0.08, 0.25, 0.5, 0.75, 0.92] : [0.12, 0.45, 0.85];
  const offsets = duration
    ? percentages.map((p) => Math.max(0.05, duration * p))
    : deep
      ? [0.2, 1.0, 2.5, 4.0, 6.0]
      : [0.2, 1.5, 3.5];

  const cacheDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(cacheDir, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(cacheDir, "tmp-moderation-"));
  const frames: Array<{ buffer: Buffer; index: number }> = [];
  try {
    for (let i = 0; i < offsets.length; i++) {
      const outFile = path.join(tempDir, `frame-${i}.png`);
      try {
        await execFileAsync(ffmpeg, [
          "-y",
          "-ss",
          String(offsets[i]),
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-q:v",
          "3",
          outFile,
        ]);
        const buffer = await fs.readFile(outFile);
        if (buffer.length > 0) frames.push({ buffer, index: i });
      } catch {
        /* frame beyond video duration */
      }
    }
    // Always guarantee at least frame 0 for ultra-short videos
    if (frames.length === 0) {
      const fallbackFile = path.join(tempDir, "frame-0.png");
      try {
        await execFileAsync(ffmpeg, [
          "-y",
          "-ss",
          "0",
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-q:v",
          "3",
          fallbackFile,
        ]);
        const buffer = await fs.readFile(fallbackFile);
        if (buffer.length > 0) frames.push({ buffer, index: 0 });
      } catch {
        /* unreadable video */
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  return frames;
}

// ---------- Overall Pipeline ----------

export async function runModeration(input: ModerationInput): Promise<ModerationResult> {
  const startedAt = Date.now();
  const deep = Boolean(input.deep);
  const notes: string[] = [];
  const resultStage = {
    textScore: null as number | null,
    imageScore: null as number | null,
    textVerdict: "pass",
    imageVerdict: "pass",
    textMatches: [] as string[],
    linksChecked: 0,
    framesAnalyzed: 0,
  };

  // 1. Caption + Music text check
  const combinedText = [input.caption, input.musicName].filter(Boolean).join(" ");
  const text = await classifyText(combinedText, notes, deep);
  resultStage.textScore = typeof text.score === "number" ? text.score : null;
  resultStage.textVerdict = text.verdict;
  resultStage.textMatches = text.matches;
  resultStage.linksChecked = text.linksChecked;

  // Short-circuit immediately if severe explicit text/link already flagged (fastest response!)
  if (text.verdict === "flagged") {
    return {
      verdict: "rejected",
      reason: "Obscene or prohibited content detected — automatically deleted.",
      provider: "nsfwjs (MobileNetV2Mid) + toxicity + ffmpeg (open-source)",
      durationMs: Date.now() - startedAt,
      details: {
        ...resultStage,
        stageNotes: notes,
        deep,
      },
    };
  }

  // 2. Local uploaded photo files
  if (input.imageFilePaths && input.imageFilePaths.length > 0) {
    for (const imgPath of input.imageFilePaths) {
      try {
        const buffer = await fs.readFile(imgPath);
        resultStage.framesAnalyzed += 1;
        const cls = await classifyOneImage(buffer, notes, deep);
        if (cls.score != null) {
          resultStage.imageScore = Math.max(resultStage.imageScore ?? 0, cls.score);
        }
        if (cls.verdict === "flagged") {
          resultStage.imageVerdict = "flagged";
          break;
        } else if (cls.verdict === "unsure") {
          resultStage.imageVerdict = "unsure";
        }
      } catch (err) {
        notes.push(`photo file unreadable: ${err instanceof Error ? err.message : String(err)}`);
        resultStage.imageVerdict = "unsure";
      }
    }
  }

  // 2b. Remote image URLs (multi-photo or cover URL when no local file was already scanned)
  const remoteCandidates = new Set<string>();
  if (input.remoteImageUrls) {
    for (const url of input.remoteImageUrls) {
      if (/^https?:\/\//i.test(url)) remoteCandidates.add(url);
    }
  }
  if (
    input.coverUrl &&
    /^https?:\/\//i.test(input.coverUrl) &&
    (!input.imageFilePaths || input.imageFilePaths.length === 0) &&
    !input.videoFilePath
  ) {
    remoteCandidates.add(input.coverUrl);
  }

  if (resultStage.imageVerdict !== "flagged" && remoteCandidates.size > 0) {
    for (const remoteUrl of remoteCandidates) {
      const buffer = await fetchImage(remoteUrl, notes);
      if (!buffer) {
        resultStage.imageVerdict = "unsure";
      } else {
        resultStage.framesAnalyzed += 1;
        const cls = await classifyOneImage(buffer, notes, deep);
        if (cls.score != null) {
          resultStage.imageScore = Math.max(resultStage.imageScore ?? 0, cls.score);
        }
        if (cls.verdict === "flagged") {
          resultStage.imageVerdict = "flagged";
          break;
        } else if (cls.verdict === "unsure") {
          resultStage.imageVerdict = "unsure";
        }
      }
    }
  }

  // 3. Local video frame sampling & classification
  if (resultStage.imageVerdict !== "flagged" && input.videoFilePath) {
    try {
      const frames = await sampleVideoFrames(input.videoFilePath, deep);
      resultStage.framesAnalyzed += frames.length;
      let frameFlagged = false;
      let frameUnsure = false;
      for (const frame of frames) {
        const cls = await classifyOneImage(frame.buffer, notes, deep);
        if (cls.score != null) {
          resultStage.imageScore = Math.max(resultStage.imageScore ?? 0, cls.score);
        }
        if (cls.verdict === "flagged") {
          frameFlagged = true;
          break;
        } else if (cls.verdict === "unsure") {
          frameUnsure = true;
        }
      }
      if (frameFlagged) {
        resultStage.imageVerdict = "flagged";
      } else if (frames.length === 0) {
        notes.push("no video frames could be sampled");
        resultStage.imageVerdict = "unsure";
      } else if (frameUnsure || resultStage.imageVerdict === "unsure") {
        resultStage.imageVerdict = "unsure";
      }
    } catch (err) {
      notes.push(
        `video frame analysis unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
      if (resultStage.imageVerdict === "pass") resultStage.imageVerdict = "unsure";
    }
  }

  // 4. Final Verdict
  const flagged = resultStage.textVerdict === "flagged" || resultStage.imageVerdict === "flagged";
  const unsure = resultStage.textVerdict === "unsure" || resultStage.imageVerdict === "unsure";

  let verdict: ModerationVerdict;
  let reason: string;
  if (flagged) {
    verdict = "rejected";
    reason =
      resultStage.textVerdict === "flagged"
        ? "Obscene or prohibited content detected in text/link — automatically deleted."
        : "Obscene or explicit visual content detected by AI — automatically deleted.";
  } else if (unsure) {
    verdict = "hidden_recheck";
    const summary = notes.slice(0, 2).join("; ");
    reason = summary
      ? `Temporarily hidden for fast AI re-check: ${summary}`
      : "Temporarily hidden for fast AI re-check.";
  } else {
    verdict = "approved";
    reason = "Passed open-source AI content checks.";
  }

  return {
    verdict,
    reason,
    provider: "nsfwjs (MobileNetV2Mid) + toxicity + ffmpeg (open-source)",
    durationMs: Date.now() - startedAt,
    details: {
      textScore: resultStage.textScore,
      imageScore:
        resultStage.imageScore != null ? Math.round(resultStage.imageScore * 10000) / 10000 : null,
      textVerdict: resultStage.textVerdict,
      imageVerdict: resultStage.imageVerdict,
      textMatches: resultStage.textMatches,
      linksChecked: resultStage.linksChecked,
      framesAnalyzed: resultStage.framesAnalyzed,
      stageNotes: notes,
      deep,
    },
  };
}

/**
 * Runs AI moderation on an existing DB post/video (used for fast hidden re-checks,
 * user reports, and periodic scanning of older posts/videos).
 * - Obscene/flagged -> permanently deletes from DB + Storage!
 * - Uncertain -> temporarily hides (`hidden_recheck`) or escalates to `manual_review` after 2 rechecks.
 * - Clean -> approves (`approved`) and stamps `moderatedAt`.
 */
export async function moderateExistingVideoRecord(
  videoId: number,
  options?: { deep?: boolean; trigger?: string }
): Promise<{
  outcome: "not_found" | "auto_deleted" | "hidden_recheck" | "manual_review" | "approved";
  reason: string;
  result?: ModerationResult;
}> {
  const rows = await db
    .select({ v: videos, handle: users.handle })
    .from(videos)
    .innerJoin(users, eq(videos.userId, users.id))
    .where(eq(videos.id, videoId))
    .limit(1);

  const row = rows[0];
  if (!row) return { outcome: "not_found", reason: "Post not found" };

  const localImages: string[] = [];
  const remoteImages: string[] = [];

  if (row.v.mediaUrls) {
    try {
      const parsed = JSON.parse(row.v.mediaUrls);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const url = typeof item === "string" ? item : item?.url;
          if (typeof url !== "string") continue;
          const local = resolveLocalUploadPath(url);
          if (local) localImages.push(local);
          else if (/^https?:\/\//i.test(url)) remoteImages.push(url);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const localVideo = resolveLocalUploadPath(row.v.videoUrl);
  const localCover = resolveLocalUploadPath(row.v.coverUrl);
  if (localCover && !localImages.includes(localCover) && !localVideo) {
    localImages.push(localCover);
  }

  const result = await runModeration({
    caption: row.v.caption,
    musicName: row.v.musicName,
    coverUrl: row.v.coverUrl,
    remoteImageUrls: remoteImages,
    videoFilePath: localVideo,
    imageFilePaths: localImages,
    deep: options?.deep ?? true,
  });

  const now = new Date();

  if (result.verdict === "rejected") {
    await permanentlyDeletePostAndStorage(videoId, {
      action: "auto_deleted",
      status: "auto_deleted",
      reason: result.reason,
      imageScore: result.details.imageScore,
      textScore: result.details.textScore,
      imageVerdict: result.details.imageVerdict,
      textVerdict: result.details.textVerdict,
      details: { ...result.details, trigger: options?.trigger ?? "recheck" },
      reviewedBy: "ai-moderator",
    });
    return { outcome: "auto_deleted", reason: result.reason, result };
  }

  if (result.verdict === "hidden_recheck") {
    const nextCount = row.v.recheckCount + 1;
    const escalate = nextCount >= 2;
    const nextStatus = escalate ? "manual_review" : "hidden_recheck";
    const nextAt = escalate ? null : new Date(Date.now() + 10_000);

    await db
      .update(videos)
      .set({
        status: nextStatus,
        recheckCount: nextCount,
        nextRecheckAt: nextAt,
        moderatedAt: now,
        moderationReason: escalate
          ? `Kept hidden for moderator review after ${nextCount} AI checks: ${result.reason}`
          : result.reason,
      })
      .where(eq(videos.id, videoId));

    await db
      .insert(moderationLogs)
      .values({
        videoId,
        action: nextStatus,
        status: nextStatus,
        authorHandle: row.handle,
        captionSnapshot: row.v.caption,
        imageScore: result.details.imageScore != null ? String(result.details.imageScore) : null,
        textScore: result.details.textScore != null ? String(result.details.textScore) : null,
        imageVerdict: result.details.imageVerdict,
        textVerdict: result.details.textVerdict,
        reason: result.reason,
        details: JSON.stringify({
          ...result.details,
          trigger: options?.trigger ?? "recheck",
          recheckCount: nextCount,
        }),
      })
      .catch(() => {});

    return { outcome: nextStatus, reason: result.reason, result };
  }

  // Approved
  const wasHidden = row.v.status !== "approved";
  await db
    .update(videos)
    .set({
      status: "approved",
      moderatedAt: now,
      nextRecheckAt: null,
      moderationReason: result.reason,
    })
    .where(eq(videos.id, videoId));

  if (wasHidden) {
    await db
      .insert(moderationLogs)
      .values({
        videoId,
        action: "approved",
        status: "approved",
        authorHandle: row.handle,
        captionSnapshot: row.v.caption,
        imageScore: result.details.imageScore != null ? String(result.details.imageScore) : null,
        textScore: result.details.textScore != null ? String(result.details.textScore) : null,
        imageVerdict: result.details.imageVerdict,
        textVerdict: result.details.textVerdict,
        reason: "Cleared after fast AI re-check.",
        details: JSON.stringify({ ...result.details, trigger: options?.trigger ?? "recheck" }),
        reviewedBy: "ai-moderator",
        reviewedAt: now,
      })
      .catch(() => {});
  }

  return { outcome: "approved", reason: result.reason, result };
}
