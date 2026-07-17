import { WorkspaceBase } from '../impls/workspace-base.js';

export type {
  DocCollectionOptions,
  WorkspaceOptions,
} from '../impls/workspace-base.js';

/**
 * @internal
 * Test only
 * Do not use this in production — use `WorkspaceImpl` from `@labre/store`.
 *
 * Independent from `WorkspaceImpl`: both derive from the shared internal
 * {@link WorkspaceBase} (neither extends the other), so a test-only helper
 * added here never leaks into the production class.
 */
export class TestWorkspace extends WorkspaceBase {}
