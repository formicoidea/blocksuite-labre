# `@labre/integration-test`

Integration test for BlockSuite.

## Running Tests

Run the whole suite from the repository root, as CI does:

```bash
yarn test:integration
```

It runs two browser sessions one after the other (`scripts/test-integration.mjs`,
`--shard=1/2` then `--shard=2/2`): one page over the whole suite grows too
large ([docs/contribute/04-testing.md](../../docs/contribute/04-testing.md)).
Arguments reach both sessions:

```bash
# Run all tests in a specific file
yarn test:integration src/__tests__/edgeless/viewport-renderer.spec.ts

# Run a specific test
yarn test:integration -t "should access turbo renderer instance"
```

This package's own `test:unit` is one session over whatever it is given:
use it from this directory for a single spec, never for the whole suite.

```bash
cd packages/integration-test
yarn test:unit src/__tests__/edgeless/viewport-renderer.spec.ts
```

For debugging tests with the Playwright debugger:

```bash
yarn test:debug

yarn test:debug -t "should access turbo renderer instance"
```
