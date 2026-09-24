# Architecture decision records

One file per decision. Format and lifecycle in
[../contribute/06-decisions.md](../contribute/06-decisions.md).

| #                                                              | Title                                | Status                    | One line                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [0001](0001-assumed-divergence-from-upstream.md)               | Assumed divergence from upstream     | accepted                  | We do not track AFFiNE; targeted cherry-picks only; never `@blocksuite/*`.                                    |
| [0002](0002-flag-gated-block-registry.md)                      | Flag-gated block registry            | partly superseded by 0009 | One flag per optional block, read at the three assembly points; missing means enabled.                        |
| [0003](0003-telemetry-bus-and-taxonomy.md)                     | Telemetry bus and taxonomy           | accepted                  | The library emits typed events; the host injects the adapter. Block lifecycle and framework taxonomies.       |
| [0004](0004-public-workspace-implementation.md)                | Public `WorkspaceImpl`               | accepted                  | A production workspace class; nothing under `store/test` is for hosts.                                        |
| [0005](0005-element-docid-seam.md)                             | Element `pivotDocId` seam            | proposed                  | One optional field binding an element to a host record, opaque to the library.                                |
| [0006](0006-pivot-properties-provider.md)                      | `PivotPropertiesProvider`            | proposed                  | Typed, render-free record properties as signals; the host never hands the library markup.                     |
| [0007](0007-universe-tag-defs-format.md)                       | Universe tag definitions             | proposed                  | Three precision levels; ids `<framework>:<local>`, forever; the app seeds, the library fixes the format.      |
| [0008](0008-command-registry-foundation.md)                    | Command registry                     | proposed, amended         | `CommandDescriptor` is the source; menus, shortcuts, palette, agent are projections. One framework identity.  |
| [0009](0009-reversed-flag-contract.md)                         | Reversed flag contract               | accepted, amended         | Flags gate tooling, never content. Two view extensions per framework.                                         |
| [0010](0010-persisted-relation-direction.md)                   | Persisted relation direction         | proposed                  | Source is the subject of the role's verb, target its object.                                                  |
| [0011](0011-editor-anchored-info-panels.md)                    | Editor-anchored info panels          | accepted                  | Canvas metadata panels anchor to the editor, in one shared class.                                             |
| [0012](0012-framework-interchange-and-foreign-preservation.md) | Interchange and foreign preservation | accepted                  | Capabilities per (framework, format, direction); pure parsers; unknown data preserved on the element.         |
| [0013](0013-cynefin-framworks-carries-no-validation-rules.md)  | Cynefin carries no validation rules  | accepted, amended         | A sensemaking frame has no rules to check; reading is not validation.                                         |
| [0014](0014-senior-submenu-rules.md)                           | Senior sub-menu rules                | accepted, amended         | Cap 13 + 1, declared eligibility, recency and frequency, one mechanism for every framework.                   |
| [0015](0015-rule-dependency-scope.md)                          | Rule dependency scope                | accepted                  | A rule family declares what its verdict depends on; a rule may only widen it.                                 |
| [0016](0016-hollow-endpoint-styles.md)                         | Hollow endpoint heads                | accepted                  | `PointStyle` is persisted and append-only; an older client paints no head. Hollow heads use the card fill.    |
| [0017](0017-uml-one-framework-with-diagram-kinds.md)           | UML is one framework                 | accepted                  | One senior button, one flag; the diagram kind is a field on the board. Scope by phase; no metamodel checked.  |
| [0018](0018-connector-per-end-labels-deferred.md)              | Per-end connector labels deferred    | superseded by 0020        | One label per connector: the centre carries the name, end multiplicities are free text until phase 2.         |
| [0019](0019-uml-import-formats.md)                             | UML reads three formats              | accepted                  | PlantUML and XMI in both directions, draw.io in only and `visual`; the compressed payload is the command's.   |
| [0020](0020-connector-end-labels.md)                           | Connector end labels                 | accepted                  | Four flat optional fields; absent by default, so no migration. An end label follows its own endpoint.         |
| [0021](0021-label-syntax-rule-family.md)                       | `label-syntax` rule family           | accepted                  | The first family whose verdict is the framework's own parser; `element` scope; per line, ellipsis dropped.    |
| [0022](0022-uml-sequence-diagrams-scope.md)                    | UML sequence diagrams                | accepted                  | Kind `sd`: a lifeline is a narrow column, a fragment is a board with operand zones, time is y. Gates out.     |
| [0023](0023-every-displayed-string-through-a-key.md)           | Every displayed string through a key | accepted                  | Params and `Intl` cross the seam; wordings per package; a shrinking baseline guards against new literals.     |
| [0024](0024-border-proximity-rule-family.md)                   | `border-proximity` rule family       | accepted                  | Centre within N units of a carrier node's outline; overlap is the gate; `surface` scope.                      |
| [0025](0025-board-svg-export.md)                               | Board SVG export                     | accepted                  | The canvas renderer replays into svgcanvas; one core command and one wildcard "⋮" entry for every board.      |
| [0026](0026-legend-is-a-catalogue-subscription.md)             | A legend is a subscription           | accepted                  | A command declares its row; the board's legend is derived from the catalogue. One button, gated, one emitter. |
| [0027](0027-framework-palettes-carousel.md)                    | Colour pickers are a carousel        | accepted                  | Every active palette on every picker, base page one; it opens on the element's framework of origin. Gated.    |
| [0028](0028-iframe-sandbox-policy.md)                          | Iframe sandbox policy                | accepted                  | Every embedded iframe is sandboxed. Three levels in one module; `allow-same-origin` only on a fixed origin.   |
| [0029](0029-label-mode-by-symbol-size.md)                      | Label mode by symbol size            | accepted                  | Inscribed only if "Hello World" at 18 fits the symbol; otherwise a grouped free text. BPMN adopts it.         |

Related documents that are not ADRs:

- [../element-link-integration.md](../element-link-integration.md): the
  host integration contract for element links.
