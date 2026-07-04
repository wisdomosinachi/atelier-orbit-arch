import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const traceFile = join(process.cwd(), "node_modules", "nf3", "dist", "_chunks", "trace.mjs");

if (!existsSync(traceFile)) {
  console.warn("[netlify] nf3 trace file not found; skipping @vercel/nft patch.");
  process.exit(0);
}

const source = readFileSync(traceFile, "utf8");
const namedImport = 'import { nodeFileTrace } from "@vercel/nft";';
const defaultImport = 'import nft from "@vercel/nft";\nconst { nodeFileTrace } = nft;';

if (source.includes(defaultImport)) {
  console.log("[netlify] @vercel/nft import already patched.");
  process.exit(0);
}

if (!source.includes(namedImport)) {
  console.warn("[netlify] @vercel/nft named import not found; skipping patch.");
  process.exit(0);
}

writeFileSync(traceFile, source.replace(namedImport, defaultImport));
console.log("[netlify] Patched nf3 @vercel/nft import for Netlify build.");