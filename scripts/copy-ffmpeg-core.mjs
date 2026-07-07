import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(root, "..", "node_modules", "@ffmpeg", "core", "dist", "umd");
const dest = join(root, "..", "public", "ffmpeg");

mkdirSync(dest, { recursive: true });
copyFileSync(join(coreRoot, "ffmpeg-core.js"), join(dest, "ffmpeg-core.js"));
copyFileSync(join(coreRoot, "ffmpeg-core.wasm"), join(dest, "ffmpeg-core.wasm"));

console.log("Copied @ffmpeg/core assets to public/ffmpeg");
