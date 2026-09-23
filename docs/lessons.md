# Lessons learned

Each entry: what happened, then the rule we keep. Sources are the library's
own history and the Labre application that consumes it (the `labre` repo,
its `docs/adr/0002` and `docs/feature-flags.md`).

## From the host application (integration)

1. **Two copies of the library in one bundle.** The marketing site installed
   with npm; the editor was depended on under two names (an alias and an exact
   pin), so npm made two folders and Vite bundled both. The second copy
   re-registered every service and crashed at runtime with
   "Service already exists". The build was green.
   _Rule:_ one copy, checked by a build script that counts copies in the
   output. Use pnpm or dedupe. See [integrate/01-install.md](integrate/01-install.md).

2. **Vite's dependency optimizer does not run vanilla-extract.** In dev, the
   library's `.css.ts` files executed with no file scope and styles broke.
   Excluding the packages from the optimizer stranded deep CommonJS deps.
   _Rule:_ externalize `.css.ts` files in `optimizeDeps` with the snippet in
   [integrate/06-build-tooling.md](integrate/06-build-tooling.md).

3. **Hot reload of a host-defined custom element.** HMR re-evaluated the
   container module into a new class the tag was not bound to; `new
Container()` threw "illegal constructor" and the page hung.
   _Rule:_ the module that defines the container accepts hot updates by
   reloading the page.

4. **Extensionless relative imports in the published bundles.** Node and
   Vitest refused `./store-manager`. Fixed in the bundle compiler (0.30.2).
   _Rule:_ the published output must resolve under plain Node ESM. The
   release audit checks it. Hosts inline the scope in Vitest anyway.

5. **A flag is three-state, not boolean.** In one week: a console-disabled
   flag vanished from the payload and was read as "enabled"; a stored local
   preference re-enabled a killed framework with no way out; applying "missing
   means off" to every key hid attachments and links, because those keys were
   never created in the flag service.
   _Rule:_ the library states its default (absent means enabled). The host
   applies "missing means off" only to keys it created.

6. **A flag once removed a schema.** A client with the flag off could not
   understand documents containing the block. Copy, duplicate and resave
   dropped the content silently.
   _Rule:_ ADR 0009. Flags gate tooling, never content.

7. **Six weeks of library in one version jump.** Three compile breaks and one
   silent behaviour change (the framework descriptor shape).
   _Rule:_ upgrade in small hops. Type list-shaped contracts as
   `Record<FrameworkId, …>` so a new framework is a compile error, not a
   missing button. Derive order from `FRAMEWORK_DESCRIPTORS`, never restate it.

8. **signals-core 1.14 changed `batch()`.** A batch ending on its initial value
   notifies nobody, so "toggle off then on to refresh" became a no-op and
   toolbar buttons froze.
   _Rule:_ never force a repaint by toggling a value. Bump a revision counter.
   Declare peer versions as a real contract.

9. **A network default pointed at a third party.** The link preview service
   called an AFFiNE worker, and offered no way to add an `Authorization`
   header, so the host re-implemented the query.
   _Rule:_ every network call in the library has an injectable endpoint and
   `fetch`. The default respects privacy.

10. **Optional providers fail silently.** No notification provider: the whole
    import report vanished. No pivot picker: the "link to a record" button never
    existed. No quick search: the link command was gated off.
    _Rule:_ the seams table in [integrate/04-host-seams.md](integrate/04-host-seams.md)
    says what disappears. Keep it current.

11. **The library's default UI fought the host shell.** The artefact catalogue
    drew its own side panel next to the application's rail: two sidebars.
    _Rule:_ the host can replace a default UI through an extension. It must
    not pass `null`, which would remove the button too.

12. **`meta.initialize()` before hydration wiped the corpus.** A fresh empty
    `pages` array won the Y.Map key conflict against the persisted one.
    _Rule:_ hydrate the workspace root document first, then initialize meta.
    See [integrate/05-persistence-and-sync.md](integrate/05-persistence-and-sync.md).

13. **The app built on a class marked test-only.** `TestWorkspace` was the
    only exported workspace for months.
    _Rule:_ production code uses `WorkspaceImpl` (ADR 0004). Nothing under
    `store/test` is for hosts.

14. **A reading panel that only opened for one framework.** Seven frameworks
    shipped with the registration line missing. The product owner found it by
    clicking.
    _Rule:_ coverage tests mount the real extensions and read the container
    back, instead of importing the exported constant.

15. **Boards that re-implemented the base class.** EDGY and Cynefin boards
    copied the background overrides instead of extending
    `FrameworkBackgroundElementModel`, so `instanceof` skipped them and dropped
    elements sank under the board.
    _Rule:_ extend the shared base. A copy is a future bug.

## From the library itself (contributing)

16. **Commit scopes are the upstream list.** There is no `wardley` scope. A
    `feat(wardley): …` subject is rejected by the hook and by the PR title
    check. Use `edgeless` for canvas frameworks, `blocks` when unsure. The
    subject must be sentence-case or fully lowercase.

17. **CI typechecks everything, tests included.** A green `vitest` plus a
    partial `tsc -b <package>` can still fail CI: the partial build may reuse
    a cached `.tsbuildinfo` and skip a new test file. Run `tsc -b --force`
    on the package after adding a test.

18. **Agent worktrees fork from a stale base.** A worktree cut from an old
    mirror produced a 2211-file pull request. Always check `git log -1`
    against `origin/blocksuite-labre-main` before starting.

19. **Worktrees are checked out with CRLF.** `prettier --check` then flags every
    file. Check with `--end-of-line auto`, or check the committed blobs.

20. **The GitHub default branch is `main`, which is dead.** A pull request
    against it shows thousands of files. Target `blocksuite-labre-main`. A
    `Closes #N` in a PR body does not auto-close on a non-default branch:
    close issues by hand.

21. **Squash merges break stacked PRs.** Branch off `blocksuite-labre-main`,
    merge it in to sync (merge commits are fine, the squash flattens them).
    If a stack must be repaired, rebase onto main and push a new branch with a
    replacement PR.

22. **npm masks an expired token as a 404.** `npm publish` on a scoped package
    with a dead token returns "404 Not Found", never a login prompt. Run
    `npm whoami` first.

23. **The frame-time benchmark is load-sensitive.** The Wardley validation
    benchmark ("under 16 ms") fails about one run in three under load. Rerun
    it alone before calling it a regression.

24. **The playground browser pane is not a test oracle.** Console probes cannot
    subscribe to the app's signals (Vite serves a second signals-core
    instance), synthetic keydown events do not drive the dispatcher. Use the
    integration suite for keyboard paths, and read app state rather than
    subscribing to it.

25. **A compartment sized by the author's newlines.** A framework tier is
    created with `hasMaxWidth`, so the canvas renderer WRAPS a long signature
    before it paints it — and a layout that counted `\n` put a six-line stack
    back into a three-line box, through the separator under it.
    _Rule:_ a compartment is sized by what is PAINTED. Measure with the
    renderer's own `wrapText` and `getLineHeight` (`gfx/text`), never a line
    count.

26. **An emptied tier deleted out of its own group.** The canvas text editor
    deletes a text committed empty, which is right for a text somebody
    abandoned and wrong for a COMPARTMENT: the classifier lost its name
    compartment and the next double-click fell through to the shape's own
    invisible inner text.
    _Rule:_ a text carrying a `role` and a fixed width is a compartment tier. It
    survives being emptied, placeholder and all; a roled label with no
    `hasMaxWidth` — a Wardley label, a BPMN name — is still deleted.

27. **A generous grab the dispatcher never honoured.** Connector end labels
    were picked within 24 units of an arrowhead, but a connector's hit test is
    its LINE — 8 units off the stroke, plus half its width — so anywhere past
    that the double-click reached no view at all and the editor's add-text-here
    handler answered it instead.
    _Rule:_ a gesture's reach is the element's `includesPoint`, not the
    picker's. Widening one without the other writes dead code.

28. **A package's own Vite cache ran the tests against an older engine.** Adding
    a rule family to `blocks/surface` and a rule using it to `gfx/uml` made 177
    of the UML package's 194 unit tests fail with
    `RULE_FAMILIES[rule.family] is not a function` — the pack was right and the
    engine it ran against was not the one on disk. `gfx/uml/node_modules/.vite`
    held a pre-bundled copy of the surface package from before the edit, and the
    stack trace pointed into the current source through a stale source map, so
    the quoted line did not exist at that line number.
    _Rule:_ a cross-package change that fails impossibly in one package's unit
    suite — a symbol the source plainly exports reading as `undefined`, a stack
    frame quoting a line the file does not have — is a stale
    `<package>/node_modules/.vite`. Delete it and re-run before debugging the
    code.

29. **A key to the notation that read differently on every board.** The shared
    legend engine opened a section on the first row that LIT, so the order of
    the sub-titles was a property of the board rather than of the framework: a
    BPMN pool holding a user task but no plain task listed Gateways and Flows
    ahead of Activities, and the same pool with a plain task added read another
    way again. A legend is a KEY — the same notation must read the same way
    every time, and only the rows may change.
    _Rule:_ when a derivation groups rows into declared buckets, open the
    buckets from the DECLARATION and drop the empty ones at the end. Opening
    them from the data lets the data decide the shape as well as the content.

30. **One axis of `overflow` was asked for, two were granted.** A toolbar popup
    (`components/src/toolbar/menu-button.ts`) sets `overflow-y: auto` and says
    nothing about `overflow-x`. CSS Overflow computes a `visible` axis to `auto`
    as soon as the other one is not `visible`, so the box was a HORIZONTAL
    scroll container nobody had asked for — and the palette carousel's entry
    animation, which starts at `translateX(14px)`, widened the scrollable region
    by 8px and flashed a scrollbar for the 240ms of its travel (#392). The
    symptom was one-sided because the reverse animation overflows the start
    edge, which LTR clips without ever scrolling.
    _Rule:_ write both axes whenever one of them is not `visible`. And note that
    `overflow: hidden` is still a scroll container — it paints no bar and
    answers no gesture, but `scrollLeft` still moves it, so a test that probes
    `scrollLeft` proves nothing; read the computed axis instead.
