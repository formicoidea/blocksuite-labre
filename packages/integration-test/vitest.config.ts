/// <reference types="@vitest/browser/providers/playwright" />
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';

/**
 * Real pointer input, a step at a time. `userEvent.dragAndDrop` presses, moves
 * and releases in one call, so nothing can be observed mid-gesture — the ghost
 * of a dragged row, the line at the hovered gap. These drive Playwright's
 * mouse in the test frame instead: `pointerMoveTo` moves it over the element
 * `selector` matches (open shadow roots are pierced) at a fraction of its box,
 * in `steps` intermediate moves; `pointerDown` / `pointerUp` press and release
 * where it is. Typed for the specs in `src/__tests__/utils/pointer.ts`.
 */
const pointerMoveTo: BrowserCommand<
  [selector: string, fx: number, fy: number, steps?: number]
> = async (ctx, selector, fx, fy, steps = 5) => {
  const box = await ctx.iframe.locator(selector).first().boundingBox();
  if (!box) throw new Error(`pointerMoveTo: nothing at ${selector}`);
  await ctx.page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, {
    steps,
  });
};

const pointerDown: BrowserCommand<[]> = async ctx => {
  await ctx.page.mouse.down();
};

const pointerUp: BrowserCommand<[]> = async ctx => {
  await ctx.page.mouse.up();
};

export default defineConfig(_configEnv =>
  defineConfig({
    esbuild: { target: 'es2018' },
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        // Vitest hardcodes the esbuild target to es2020,
        // override it to es2022 for top level await.
        target: 'es2022',
      },
    },
    plugins: [vanillaExtractPlugin()],
    test: {
      include: ['src/__tests__/**/*.spec.ts'],
      retry: process.env.CI === 'true' ? 3 : 0,
      browser: {
        enabled: true,
        headless: process.env.CI === 'true',
        instances: [{ browser: 'chromium' }],
        provider: 'playwright',
        commands: { pointerMoveTo, pointerDown, pointerUp },
        isolate: false,
        viewport: {
          width: 1024,
          height: 768,
        },
      },
      coverage: {
        provider: 'istanbul', // or 'c8'
        reporter: ['lcov'],
        reportsDirectory: '../../.coverage/integration-test',
      },
      deps: {
        interopDefault: true,
      },
      testTransformMode: {
        web: ['src/__tests__/**/*.spec.ts'],
      },
    },
  })
);
