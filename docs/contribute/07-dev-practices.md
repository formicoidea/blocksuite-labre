# Development practices

**How we use Lit, signals, dependency injection, the store and the gfx
model. Extracted from the code, not from a style guide.**

## Lit

- **Blocks render in light DOM.** `BlockComponent` extends
  `ShadowlessElement`: `createRenderRoot()` returns the element itself and
  the `static styles` are injected into `document.head`. Blocks compose with
  each other and with host CSS, but their styles are global: **scope every
  selector with the block's own class**.
- **Widgets and toolbar chrome keep shadow DOM** (`WidgetComponent` extends
  `LitElement`). Query them through `shadowRoot`.
- **Mixin order is always** `SignalWatcher(WithDisposable(Base))`.
  `WithDisposable` gives `this._disposables`; add every subscription to it.
- **No `@customElement` decorator.** Each package has an `effects.ts` that
  calls `customElements.define` and augments `HTMLElementTagNameMap`. A
  provider's `effect()` calls it once. This keeps `sideEffects: false`
  honest and makes registration an ordered step.

  ```ts
  // effects.ts
  export function effects() {
    customElements.define('edgeless-wardley-menu', EdgelessWardleyMenu);
  }
  declare global {
    interface HTMLElementTagNameMap {
      'edgeless-wardley-menu': EdgelessWardleyMenu;
    }
  }
  ```

- **Props** use the accessor form: `@property({ attribute: false }) accessor
model!: Model;` and `@state()` for internals. `@consume({ context:
stdContext }) accessor std!` injects the runtime.
- **Subclass, do not copy.** `EdgelessWardleyMenu extends EdgelessCommandMenu`
  is fifteen lines and renders from the command registry.

## Signals

- Read signals inside `render()`; the `SignalWatcher` mixin re-renders. Derive
  with `computed`. Group writes with `batch`.
- Outside a reactive context, read with `peek()`.
- **Never force a repaint by toggling a value off and on.** Since
  signals-core 1.14 a batch that ends on its initial value notifies nobody.
  Bump a revision counter and have subscribers read it:

  ```ts
  refresh(flag) {
    batch(() => { this.toggle(flag, true); this.#revision$.value++; });
  }
  // subscriber
  void flags.revision$.value;
  ```

- Model props are signals by construction: every prop `x` has `x$`, even
  before it exists in the Yjs map.

## Dependency injection

- Identifiers: `createIdentifier<T>('Name')`. Registration: an object with
  `setup(di)` that calls `di.override(Identifier, () => impl)` or
  `di.addImpl(...)`.
- **`std.get(X)` for what the library registers itself.
  `std.getOptional(X)` for what the host may provide**, always with an
  explicit fallback (hide the button, log once, do nothing).
- Stateful, editor-scoped services extend `LifeCycleWatcher` with a static
  `key`; hooks run `created`, `rendered`, `mounted`, `unmounted`.
- Duplicate registration throws at boot. When two modules must attach to the
  same flavour, give the key an owner:
  `toolbarModuleKey('custom:affine:surface:group', 'wardley-morph')`.

## Store and undo

- Element writes go through `std.get(EdgelessCRUDIdentifier).updateElement`,
  block writes through `store.updateBlock` / `addBlock` / `deleteBlock`.
  Never touch a `Y.Map` directly.
- `store.captureSync()` before a user gesture so one gesture is one undo
  step.
- `store.withoutTransact(() => …)` for transient churn during a drag.
- Do not write when nothing changed: an unchanged write pushes an empty undo
  entry and may persist a resolved translation as user text.
- Every mutation entry point checks `store.readonly` first.
- **Cascade only on local edits, and only when writeable:**

  ```ts
  surface.elementUpdated.subscribe(({ id, props, local }) => {
    if (!local || surface.store.readonly) return;
    …
  });
  ```

  Without the local guard every peer re-applies the cascade (connector, frame
  and mindmap did, fixed in PR #253; regression test
  `remote-cascade-connector.unit.spec.ts`). Without the readonly guard a local
  edit on a store the host has put in readonly throws
  `Cannot remove element in readonly mode` (issue #318; regression test
  `remote-cascade.unit.spec.ts`). A cascade that cannot run is harmless: the
  author's own cascade arrives through sync.

  Write a cascade **once**. The "group emptied" cascade lived both in
  `SurfaceBlockModel._watchGroupRelationChange` and in a `group-watcher`
  surface middleware, so every throw fired twice; the middleware is gone and
  the std watcher is the only implementation.

## Gfx element models and views

- Persisted props are `@field()` accessors on a subclass of a base model.
  An `undefined` default is never written: optional fields need no migration.
- Enum-like values are append-only.
- Other decorators in `std/gfx/model/surface/decorators/`: `@derive`
  (recompute siblings on write), `@convert` (normalize before write),
  `@observe` (react to deep Yjs changes), `@local` (not synced), `@watch`
  (side effect with `(old, instance, local)`).
- Register the type in `SurfaceElementModelMap`
  (`packages/affine/model/src/elements/index.ts`).
- Painting is `ElementRendererExtension(type, renderer)`; export the renderer
  as a bare function so tests drive it with a canvas stub.
- Interaction is a `GfxElementModelView` subclass with `static override
type`, registered with `context.register(View)`.
- **Hit-testing seam.** The model's `includesPoint` is picking geometry. To
  widen the _interactive_ area without changing picking, override
  `includesPoint` in the **view**, call `super` first:

  ```ts
  override includesPoint(x, y, options, host) {
    if (super.includesPoint(x, y, options, host)) return true;
    return this._labelAt(x, y) !== null;
  }
  ```

  `getRelativePointLocation` is the connector-anchor seam. Override it, not
  the connector.

## Commands, shortcuts, translations, telemetry

- One `CommandDescriptor` per user-facing action. The senior menu, the
  catalogue, the palette, the shortcuts pane and the AI agent derive from it.
  Fields: `id`, `owner`, `kind`, `labelKey`, `iconKey`, `category`,
  `surfaces`, `scope`, `defaultKeys`, `availability`, `when`, `run`,
  `params`, `telemetry`.
- Shortcuts are chords per platform, rebindable by the host through
  `KeymapOverrideExtension`, conflict-checked by `resolveKeymap`. `[]` means
  no default chord, still bindable.
- **No prose in the library.** Every user-visible string is a `com.labre.*`
  key with an English fallback in the declaration; each framework exports
  `translationEntries` derived from its declarations. A `fallback: undefined`
  is a deliberate refusal.
- Telemetry of a command is emitted by `runCommand`, from the descriptor's
  `telemetry` field. The only manual emission left is the auto-legend button
  on a board toolbar, which is not a command — and it is one call site for
  every framework, `trackLegendCreated` (ADR 0026).

## Tests

See [04-testing.md](04-testing.md). Two habits worth repeating: a docblock
that says why the spec exists, and a parity test for anything spelled twice.

## Hygiene

- TypeScript strict with `noImplicitOverride`, `noUnusedLocals`,
  `verbatimModuleSyntax`. `override` and `import type` where they apply.
- `.js` suffix on relative imports in `src/`.
- Named exports only.
- Prettier only. No ESLint.
- Comments and identifiers in English. Docblocks say why and cite the issue
  or ADR.
- `ponytail:` marks a deliberate shortcut, with its ceiling and the condition
  that reverses it.
- No license header per file; MPL-2.0 is declared in `package.json` and the
  root `LICENSE`. Changing that is a red zone.

## Host frameworks (React, Vue…)

The library has no React. Everything is a web component. A React host
renders the container element, sets its properties in an effect, and loads
the module lazily. It injects its services through the seams in
[integrate/04-host-seams.md](../integrate/04-host-seams.md). There is no
first-party React wrapper; do not document one as if it shipped.
