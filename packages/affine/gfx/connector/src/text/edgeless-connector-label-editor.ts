import {
  DefaultTool,
  EdgelessCRUDIdentifier,
} from '@labre/affine-block-surface';
import { getLineHeight } from '@labre/affine-gfx-text';
import {
  type ConnectorElementModel,
  connectorEndLabelBox,
  type ConnectorLabelEnd,
} from '@labre/affine-model';
import type { RichText } from '@labre/affine-rich-text';
import { ThemeProvider, translateKey } from '@labre/affine-shared/services';
import { almostEqual } from '@labre/affine-shared/utils';
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { Bound, type IVec, Vec, type XYWH } from '@labre/global/gfx';
import { WithDisposable } from '@labre/global/lit';
import {
  type BlockComponent,
  type BlockStdScope,
  ShadowlessElement,
  stdContext,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@labre/std/inline';
import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import * as Y from 'yjs';

import { CONNECTOR_ADD_TEXT } from '../translations.js';

const HORIZONTAL_PADDING = 2;
const VERTICAL_PADDING = 2;
const BORDER_WIDTH = 1;

/** The box a label is seeded with, before the first character is typed. */
const DEFAULT_LABEL_SIZE = { w: 16, h: 16 };

/**
 * Which of a connector's three labels a gesture is about — its centre caption,
 * or one of the two end labels UML writes multiplicities and role names in
 * (`docs/adr/0018` phase 2).
 *
 * Built on the model's own `ConnectorLabelEnd` rather than restating its two
 * members: the ends are the model's vocabulary — they are the names of its two
 * `Connection`s — and only the EDITOR has a third case, because only the editor
 * has to be pointed at one label out of three.
 */
export type ConnectorLabelWhich = 'center' | ConnectorLabelEnd;

/**
 * The model fields each label lives in.
 *
 * Declared once, as data, because THREE places need the same answer — the
 * editor's read, its resize write and its empty-commit delete — and three
 * `which === 'center' ? … : …` chains is how one of them ends up writing the
 * centre label's box under an end label's text.
 */
export const CONNECTOR_LABEL_FIELDS = {
  center: { text: 'text', xywh: 'labelXYWH' },
  source: { text: 'sourceLabel', xywh: 'sourceLabelXYWH' },
  target: { text: 'targetLabel', xywh: 'targetLabelXYWH' },
} as const satisfies Record<
  ConnectorLabelWhich,
  { text: string; xywh: string }
>;

/** {@link CONNECTOR_LABEL_FIELDS}, defaulting to the centre label. */
export function connectorLabelFields(which: ConnectorLabelWhich = 'center') {
  return CONNECTOR_LABEL_FIELDS[which];
}

/** The `Y.Text` of `which`, or `undefined` when that label does not exist. */
export function connectorLabelText(
  connector: ConnectorElementModel,
  which: ConnectorLabelWhich = 'center'
): Y.Text | undefined {
  return which === 'center' ? connector.text : connector.endLabelText(which);
}

/** The box of `which`, or `undefined` when that label does not exist. */
export function connectorLabelXYWH(
  connector: ConnectorElementModel,
  which: ConnectorLabelWhich = 'center'
): XYWH | undefined {
  return which === 'center'
    ? connector.labelXYWH
    : connector.endLabelXYWH(which);
}

/**
 * The box an end label of `size` takes on the current path — the one geometry
 * helper the model owns, so the renderer, the editor and the hit test all place
 * an end label in the same spot.
 */
export function connectorEndLabelBoxFor(
  connector: ConnectorElementModel,
  which: ConnectorLabelEnd,
  size: { w: number; h: number } = DEFAULT_LABEL_SIZE
): XYWH {
  return connectorEndLabelBox(connector.absolutePath, which, size);
}

/**
 * What to write so that `which` EXISTS, or `null` when it already does.
 *
 * The centre label is seeded where the pointer is, riding the path by an offset
 * distance — it has always been a caption the author places. An end label is
 * seeded at its ENDPOINT and ignores the pointer: the whole value of one is
 * that it follows the end when the node moves (`docs/adr/0018`, "Alternatives
 * rejected"), so where the double-click landed says nothing about where it
 * belongs.
 */
export function connectorLabelSeedProps(
  connector: ConnectorElementModel,
  which: ConnectorLabelWhich = 'center',
  point?: IVec
): Record<string, unknown> | null {
  if (connectorLabelText(connector, which)) return null;

  const fields = connectorLabelFields(which);
  const text = new Y.Text();

  if (which !== 'center') {
    return {
      [fields.text]: text,
      [fields.xywh]: connectorEndLabelBoxFor(connector, which),
    };
  }

  let labelXYWH: XYWH = connector.labelXYWH ?? [
    0,
    0,
    DEFAULT_LABEL_SIZE.w,
    DEFAULT_LABEL_SIZE.h,
  ];
  const labelOffset = { ...connector.labelOffset };

  if (point) {
    const center = connector.getNearestPoint(point);
    const distance = connector.getOffsetDistanceByPoint(center as IVec);
    const bounds = Bound.fromXYWH(labelXYWH);
    bounds.center = center;
    labelOffset.distance = distance;
    labelXYWH = bounds.toXYWH();
  }

  return { text, labelXYWH, labelOffset };
}

/**
 * What to write when an editing session ENDS, or `null` when the text is
 * already exactly what the model holds.
 *
 * A label committed empty clears both of its fields, so the connector reads
 * as one that has none (`hasEndLabel` false, nothing painted, nothing
 * exported). The KEYS stay in the Y.Map as `undefined` — the field setter
 * writes what it is given — so only a connector that never carried an end
 * label is byte-identical to a pre-0020 one; `docs/adr/0020`'s "no migration"
 * promise is about that connector, not about this reset.
 *
 * Pure and exported: it is the one rule with three outcomes (delete, trim,
 * nothing) times three labels, and a spec should be able to ask it directly.
 */
export function connectorLabelCommitProps(
  raw: string,
  which: ConnectorLabelWhich = 'center'
): Record<string, unknown> | null {
  const fields = connectorLabelFields(which);
  const trimed = raw.trim();

  if (trimed.length === 0) {
    return {
      [fields.text]: undefined,
      [fields.xywh]: undefined,
      // The centre label's placement along the path goes with it; an end label
      // has no offset of its own — its place is its endpoint.
      ...(which === 'center' ? { labelOffset: undefined } : null),
    };
  }

  if (trimed.length < raw.length) {
    // @TODO: trim in Y.Text?
    return { [fields.text]: new Y.Text(trimed) };
  }

  return null;
}

/**
 * The box an END label takes after a measurement: a label that already has a
 * box keeps its CENTRE and takes the new size — the author's or the importer's
 * placement survives an edit — and a label that has none yet is seeded beside
 * its endpoint by `connectorEndLabelBox`.
 */
function endLabelRect(
  connector: ConnectorElementModel,
  which: ConnectorLabelEnd,
  w: number,
  h: number
): XYWH {
  const current = connectorLabelXYWH(connector, which);
  if (current) {
    const [cx, cy] = Bound.fromXYWH(current).center;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  return connectorEndLabelBoxFor(connector, which, { w, h });
}

export type MountConnectorLabelEditorOptions = {
  /** Which label to edit. Defaults to the centre one. */
  which?: ConnectorLabelWhich;
};

/**
 * Opens the label editor on ONE of a connector's three labels.
 *
 * This function used to exist twice — here and byte-alike in `text.ts`, which
 * was the copy the package barrel re-exported — so the toolbar and the keyboard
 * reached one body and the view's double-click the other. `docs/adr/0018`
 * phase 2 makes the difference visible (a selector only one copy would have
 * carried), so the duplicate is gone and `text.ts` re-exports this one.
 */
export function mountConnectorLabelEditor(
  connector: ConnectorElementModel,
  edgeless: BlockComponent,
  point?: IVec,
  options?: MountConnectorLabelEditorOptions
) {
  const mountElm = edgeless.querySelector('.edgeless-mount-point');
  if (!mountElm) {
    throw new BlockSuiteError(
      ErrorCode.ValueNotExists,
      "edgeless block's mount point does not exist"
    );
  }

  const which = options?.which ?? 'center';
  const gfx = edgeless.std.get(GfxControllerIdentifier);

  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({
    elements: [connector.id],
    editing: true,
  });

  const seed = connectorLabelSeedProps(connector, which, point);
  if (seed) {
    edgeless.std.get(EdgelessCRUDIdentifier).updateElement(connector.id, seed);
  }

  const editor = new EdgelessConnectorLabelEditor();
  editor.connector = connector;
  editor.which = which;

  mountElm.append(editor);
  editor.updateComplete
    .then(() => {
      editor.inlineEditor?.focusEnd();
    })
    .catch(console.error);
}

export class EdgelessConnectorLabelEditor extends WithDisposable(
  ShadowlessElement
) {
  static override styles = css`
    .edgeless-connector-label-editor {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: center;
      z-index: 10;
      padding: ${VERTICAL_PADDING}px ${HORIZONTAL_PADDING}px;
      border: ${BORDER_WIDTH}px solid var(--affine-primary-color);
      background: var(--affine-background-primary-color, #fff);
      border-radius: 2px;
      box-shadow: 0px 0px 0px 2px
        color-mix(in srgb, var(--affine-primary-color) 30%, transparent);
      box-sizing: border-box;
      overflow: visible;

      .inline-editor {
        white-space: pre-wrap !important;
        outline: none;
      }

      .inline-editor span {
        word-break: normal !important;
        overflow-wrap: anywhere !important;
      }

      .edgeless-connector-label-editor-placeholder {
        pointer-events: none;
        color: var(--affine-text-disable-color);
        white-space: nowrap;
      }
    }
  `;

  get crud() {
    return this.std.get(EdgelessCRUDIdentifier);
  }

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  get selection() {
    return this.gfx.selection;
  }

  /** The two model fields this editor reads and writes. */
  get fields() {
    return connectorLabelFields(this.which);
  }

  /** The `Y.Text` this editor is bound to. */
  get yText() {
    return connectorLabelText(this.connector, this.which);
  }

  private _isComposition = false;

  private _keeping = false;

  private _removing = false;

  private _resizeObserver: ResizeObserver | null = null;

  /**
   * Where the editor sits, in MODEL coordinates.
   *
   * The centre label rides the path by its offset distance, so its anchor is
   * recomputed from the connector; an end label's box is the anchor, and it is
   * the box that follows the endpoint (see `connectorEndLabelBox`).
   */
  private get _labelCenter(): IVec {
    const { connector, which } = this;
    if (which === 'center') {
      return connector.getPointByOffsetDistance(connector.labelOffset.distance);
    }

    const box =
      connectorLabelXYWH(connector, which) ??
      connectorEndLabelBoxFor(connector, which);
    return Bound.fromXYWH(box).center;
  }

  private readonly _updateLabelRect = () => {
    const { connector, isConnected, which } = this;
    if (!connector || !isConnected) return;

    if (!this.inlineEditorContainer) return;

    const newWidth = this.inlineEditorContainer.scrollWidth;
    const newHeight = this.inlineEditorContainer.scrollHeight;

    const labelXYWH =
      which === 'center'
        ? Bound.fromCenter(
            connector.getPointByOffsetDistance(connector.labelOffset.distance),
            newWidth,
            newHeight
          ).toXYWH()
        : endLabelRect(connector, which, newWidth, newHeight);

    const current = connectorLabelXYWH(connector, which);

    if (!current || labelXYWH.some((p, i) => !almostEqual(p, current[i]))) {
      this.crud.updateElement(connector.id, {
        [this.fields.xywh]: labelXYWH,
      });
    }
  };

  get inlineEditor() {
    return this.richText.inlineEditor;
  }

  get inlineEditorContainer() {
    return this.inlineEditor?.rootElement;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  override firstUpdated() {
    const { connector, selection, std, which } = this;
    const fields = this.fields;
    const dispatcher = std.event;

    this._resizeObserver = new ResizeObserver(() => {
      this._updateLabelRect();
      this.requestUpdate();
    });
    this._resizeObserver.observe(this.richText);

    this.connector.stash(fields.xywh);

    this.updateComplete
      .then(() => {
        if (!this.inlineEditor) return;
        this.inlineEditor.selectAll();

        this.inlineEditor.slots.renderComplete.subscribe(() => {
          this.requestUpdate();
        });

        this.disposables.add(
          dispatcher.add('keyDown', ctx => {
            const state = ctx.get('keyboardState');
            const { key, ctrlKey, metaKey, altKey, shiftKey, isComposing } =
              state.raw;
            const onlyCmd = (ctrlKey || metaKey) && !altKey && !shiftKey;
            const isModEnter = onlyCmd && key === 'Enter';
            const isEscape = key === 'Escape';
            if (!isComposing && (isModEnter || isEscape)) {
              this.inlineEditorContainer?.blur();

              selection.set({
                elements: [connector.id],
                editing: false,
              });
              return true;
            }
            return false;
          })
        );

        const surface = this.gfx.surface;

        if (surface) {
          this.disposables.add(
            surface.elementUpdated.subscribe(({ id }) => {
              if (id === connector.id) this.requestUpdate();
            })
          );
        }

        this.disposables.add(
          this.gfx.viewport.viewportUpdated.subscribe(() => {
            this.requestUpdate();
          })
        );

        this.disposables.add(dispatcher.add('click', () => true));
        this.disposables.add(dispatcher.add('doubleClick', () => true));

        this.disposables.add(() => {
          const yText = connectorLabelText(connector, which);
          if (yText) {
            const props = connectorLabelCommitProps(yText.toString(), which);
            if (props) this.crud.updateElement(connector.id, props);
          }

          if (which === 'center') {
            connector.labelEditing = false;
          } else {
            connector.endLabelEditing = null;
          }
          connector.pop(fields.xywh);

          selection.set({
            elements: [],
            editing: false,
          });
        });

        if (!this.inlineEditorContainer) return;

        this.disposables.addFromEvent(
          this.inlineEditorContainer,
          'blur',
          () => {
            // Re-entrant: Chrome fires the focused child's blur SYNCHRONOUSLY
            // inside `remove()`, before the node is detached, and the commit
            // in `disconnectedCallback` moves the focus again. Without the
            // flag the handler removes a node whose removal is in progress.
            if (this._keeping || this._removing) return;
            this._removing = true;
            this.remove();
          }
        );

        this.disposables.addFromEvent(
          this.inlineEditorContainer,
          'compositionstart',
          () => {
            this._isComposition = true;
            this.requestUpdate();
          }
        );
        this.disposables.addFromEvent(
          this.inlineEditorContainer,
          'compositionend',
          () => {
            this._isComposition = false;
            this.requestUpdate();
          }
        );

        // The canvas must not paint the label the overlay is showing, and only
        // THAT one: `hasEndLabel` is gated on `endLabelEditing`, `hasLabel()`
        // on `labelEditing`, so editing one end leaves the caption and the
        // other end drawn (`ConnectorElementModel.hasEndLabel`).
        if (which === 'center') {
          connector.labelEditing = true;
        } else {
          connector.endLabelEditing = which;
        }
      })
      .catch(console.error);
  }

  override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await this.richText?.updateComplete;
    return result;
  }

  override render() {
    const { connector } = this;
    const {
      labelStyle: {
        fontFamily,
        fontSize,
        fontStyle,
        fontWeight,
        textAlign,
        color: labelColor,
      },
      labelConstraints: { hasMaxWidth, maxWidth },
    } = connector;

    const lineHeight = getLineHeight(fontFamily, fontSize, fontWeight);
    const { translateX, translateY, zoom } = this.gfx.viewport;
    const [x, y] = Vec.mul(this._labelCenter, zoom);
    const transformOperation = [
      'translate(-50%, -50%)',
      `translate(${translateX}px, ${translateY}px)`,
      `translate(${x}px, ${y}px)`,
      `scale(${zoom})`,
    ];

    const yText = this.yText;
    const isEmpty = !yText?.length && !this._isComposition;
    const color = this.std
      .get(ThemeProvider)
      .generateColorProperty(labelColor, '#000000');

    return html`
      <div
        class="edgeless-connector-label-editor"
        style=${styleMap({
          fontFamily: `"${fontFamily}"`,
          fontSize: `${fontSize}px`,
          fontStyle,
          fontWeight,
          textAlign,
          lineHeight: `${lineHeight}px`,
          maxWidth: hasMaxWidth
            ? `${maxWidth + BORDER_WIDTH * 2 + HORIZONTAL_PADDING * 2}px`
            : 'initial',
          color,
          transform: transformOperation.join(' '),
        })}
      >
        <rich-text
          .yText=${yText}
          .enableFormat=${false}
          style=${isEmpty
            ? styleMap({
                position: 'absolute',
                left: 0,
                top: 0,
                padding: `${VERTICAL_PADDING}px ${HORIZONTAL_PADDING}px`,
              })
            : nothing}
        ></rich-text>
        ${isEmpty
          ? html`
              <span class="edgeless-connector-label-editor-placeholder">
                ${translateKey(this.std, ...CONNECTOR_ADD_TEXT)}
              </span>
            `
          : nothing}
      </div>
    `;
  }

  setKeeping(keeping: boolean) {
    this._keeping = keeping;
  }

  @property({ attribute: false })
  accessor connector!: ConnectorElementModel;

  /** Which of the connector's three labels is being edited. */
  @property({ attribute: false })
  accessor which: ConnectorLabelWhich = 'center';

  @consume({
    context: stdContext,
  })
  accessor std!: BlockStdScope;

  @query('rich-text')
  accessor richText!: RichText;
}
