/**
 * Binary grid loading (DATA_CONTRACTS "Grid encoding"). The .i8.bin.gz files
 * are pre-compressed; a server that adds Content-Encoding hands us bytes that
 * are already inflated, so we check the 1f 8b magic before gunzipping. The
 * result is verified against the sidecar's sha256 of the uncompressed bytes.
 */
import { fetchJson, LoadError } from "./loader";
import { isGridMeta, type GridMeta } from "./types";

export async function fetchBytes(url: string, onProgress: (loaded: number, total: number | null) => void, fetchImpl: typeof fetch = fetch) {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    throw new LoadError("NETWORK ERROR");
  }
  if (!res.ok) throw new LoadError(`HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length"));
  const total = !res.headers.get("content-encoding") && len > 0 ? len : null;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  onProgress(0, total);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }
  const all = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return all;
}

export async function gunzipIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function sha256Hex(bytes: Uint8Array) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Decode + verify. Throws LoadError("CHECKSUM") on a size or hash mismatch. */
export async function decodeGrid(bytes: Uint8Array, meta: GridMeta): Promise<Int8Array> {
  let raw: Uint8Array;
  try {
    raw = await gunzipIfNeeded(bytes);
  } catch {
    throw new LoadError("CHECKSUM");
  }
  const g = meta.grid;
  if (raw.byteLength !== meta.years.list.length * g.n_lat * g.n_lon || raw.byteLength !== meta.encoding.uncompressed_bytes) throw new LoadError("CHECKSUM");
  if ((await sha256Hex(raw)) !== meta.encoding.sha256_uncompressed) throw new LoadError("CHECKSUM");
  return new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

export interface Grid { meta: GridMeta; data: Int8Array }

/** Reader for ArtifactStore: sidecar JSON first, then the binary with real byte progress. */
export function gridReader(metaFile: string) {
  return async (url: string, onProgress: (l: number, t: number | null) => void, fetchImpl: typeof fetch): Promise<Grid> => {
    const metaUrl = url.replace(/[^/]+$/, metaFile);
    const meta = await fetchJson(metaUrl, () => {}, fetchImpl);
    if (!isGridMeta(meta)) throw new LoadError("SCHEMA MISMATCH");
    const bytes = await fetchBytes(url, onProgress, fetchImpl);
    return { meta, data: await decodeGrid(bytes, meta) };
  };
}
