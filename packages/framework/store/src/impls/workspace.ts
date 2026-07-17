import { WorkspaceBase } from './workspace-base.js';

/**
 * The production {@link Workspace} implementation. Self-contained: it creates
 * its own root `Y.Doc` and, by default, in-memory no-op sync engines — a host
 * that persists/syncs does so on the exposed `Y.Doc`s (`.doc`,
 * `getDoc(...).spaceDoc`) or by passing real `docSources`/`blobSources` to the
 * constructor.
 *
 * Independent from the test-only `TestWorkspace` (both derive from the shared
 * internal {@link WorkspaceBase}, neither extends the other) so test-only
 * evolutions never reach production.
 */
export class WorkspaceImpl extends WorkspaceBase {}
