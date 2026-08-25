/**
 * Root vitest workspace: every package with unit tests, so `yarn vitest run`
 * at the root (and the CI unit-test job) covers them all in one pass.
 * integration-test is excluded on purpose — it runs in browser mode
 * (playwright) and has its own CI job.
 */
export default [
  'packages/affine/all/vitest.config.ts',
  'packages/affine/blocks/bookmark/vitest.config.ts',
  'packages/affine/blocks/database/vitest.config.ts',
  'packages/affine/blocks/edgeless-text/vitest.config.ts',
  'packages/affine/blocks/root/vitest.config.ts',
  'packages/affine/blocks/surface/vitest.config.ts',
  'packages/affine/data-view/vitest.config.ts',
  'packages/affine/ext-loader/vitest.config.ts',
  'packages/affine/gfx/bpmn/vitest.config.ts',
  'packages/affine/gfx/connector/vitest.config.ts',
  'packages/affine/gfx/ddd-aggregate/vitest.config.ts',
  'packages/affine/gfx/ddd-context-map/vitest.config.ts',
  'packages/affine/gfx/ddd-core-domain/vitest.config.ts',
  'packages/affine/gfx/ddd-event-storming/vitest.config.ts',
  'packages/affine/gfx/ddd-shared/vitest.config.ts',
  'packages/affine/gfx/edgy/vitest.config.ts',
  'packages/affine/gfx/pointer/vitest.config.ts',
  'packages/affine/gfx/wardley/vitest.config.ts',
  'packages/affine/inlines/footnote/vitest.config.ts',
  'packages/affine/inlines/link/vitest.config.ts',
  'packages/affine/shared/vitest.config.ts',
  'packages/affine/widgets/linked-doc/vitest.config.ts',
  'packages/affine/widgets/slash-menu/vitest.config.ts',
  'packages/framework/global/vitest.config.ts',
  'packages/framework/std/vitest.config.ts',
  'packages/framework/store/vitest.config.ts',
  'packages/framework/sync/vitest.config.ts',
];
