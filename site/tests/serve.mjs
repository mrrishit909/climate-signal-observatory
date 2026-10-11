// Production preview (dist/) on 4321 via vite's API, so the process is not reaped by
// other agents' `vite preview` cleanups on this shared machine.
import { preview } from "vite";
const s = await preview({ preview: { port: 4321, strictPort: true } });
s.printUrls();
