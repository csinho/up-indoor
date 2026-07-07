import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

function formatUnknownError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

const FFMPEG_CORE_VERSION = "0.12.10";

function getFfmpegAssetBaseUrl() {
  return `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;
}

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = getFfmpegAssetBaseUrl();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoading;
}

function readVideoMetadata(file: File) {
  return new Promise<{ width: number; height: number; duration: number }>(
    (resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Nao foi possivel ler o video selecionado."));
      };
      video.src = url;
    },
  );
}

function isProbablyTvSafe(
  file: File,
  meta: { width: number; height: number },
) {
  const mp4Like =
    file.type === "video/mp4" ||
    file.name.toLowerCase().endsWith(".mp4");
  const evenDimensions = meta.width % 2 === 0 && meta.height % 2 === 0;
  const standardSize =
    (meta.width === 1080 && meta.height === 1920) ||
    (meta.width === 720 && meta.height === 1280) ||
    (meta.width === 1920 && meta.height === 1080) ||
    (meta.width === 1280 && meta.height === 720);

  return mp4Like && evenDimensions && standardSize && meta.width > 0;
}

async function transcodeWithFfmpeg(file: File) {
  const ffmpeg = await getFfmpeg();
  const inputName = "input.mp4";
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  await ffmpeg.exec([
    "-i",
    inputName,
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos",
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-level",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-color_range",
    "tv",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-y",
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data));

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new File([buffer], `${baseName}-tv.mp4`, {
    type: "video/mp4",
    lastModified: Date.now(),
  });
}

export async function normalizeVideoForTv(
  file: File,
  onProgress?: (message: string) => void,
): Promise<File> {
  if (!file.type.startsWith("video/")) return file;

  const meta = await readVideoMetadata(file);
  if (isProbablyTvSafe(file, meta)) {
    return file;
  }

  onProgress?.("Convertendo video para formato compativel com a TV…");

  try {
    return await transcodeWithFfmpeg(file);
  } catch (error) {
    console.error("normalizeVideoForTv failed", error);
    onProgress?.(
      "Conversao indisponivel neste navegador. Enviando o video original.",
    );
    return file;
  }
}

export function getVideoUploadErrorMessage(error: unknown) {
  return formatUnknownError(
    error,
    "Falha ao enviar o anuncio. Verifique o arquivo e tente novamente.",
  );
}
