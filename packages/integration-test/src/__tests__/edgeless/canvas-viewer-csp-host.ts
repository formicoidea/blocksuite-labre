/**
 * Loaded in the policy frame of `canvas-viewer-csp.spec.ts` before any
 * library module: the one line a host serving the viewer under a script
 * policy without `'unsafe-eval'` owns (ADR 0052,
 * `docs/integrate/09-static-html.md`).
 *
 * zod 4 probes `new Function` when it builds its first object schema, and the
 * library builds its schemas while its modules evaluate. The probe is caught
 * and zod falls back to interpreted parsing, but the browser has already sent
 * a `script-src` report. `jitless` skips the probe; zod reads it when a schema
 * is built, so it is set by a module the page loads first. The library never
 * sets it: it is global to every zod on the page, which belongs to the host.
 */
import { config } from 'zod';

config({ jitless: true });
