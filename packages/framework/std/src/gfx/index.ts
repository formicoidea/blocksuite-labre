export { generateKeyBetweenV2 } from '../utils/fractional-indexing.js';
export {
  compare as compareLayer,
  renderableInEdgeless,
  SortOrder,
} from '../utils/layer.js';
export {
  batchAddChildren,
  batchRemoveChildren,
  canSafeAddToContainer,
  descendantElementsImpl,
  getTopElements,
  hasDescendantElementImpl,
} from '../utils/tree.js';
export { GfxController } from './controller.js';
export type { CursorType, StandardCursor } from './cursor.js';
export { GfxExtension, GfxExtensionIdentifier } from './extension.js';
export { GridManager } from './grid.js';
export {
  DEFAULT_HIGHLIGHT_DURATION,
  DEFAULT_HIGHLIGHT_PADDING,
  ElementHighlightManager,
  type HighlightElementsOptions,
} from './highlight.js';
export { GfxControllerIdentifier } from './identifiers.js';
export type {
  BoxSelectionContext,
  DragEndContext,
  DragExtensionInitializeContext,
  DragInitializationOption,
  DragMoveContext,
  DragStartContext,
  ExtensionDragEndContext,
  ExtensionDragMoveContext,
  ExtensionDragStartContext,
  GfxInteractivityContext,
  GfxViewInteractionConfig,
  ResizeConstraint,
  ResizeEndContext,
  ResizeHandle,
  ResizeMoveContext,
  ResizeStartContext,
  RotateConstraint,
  RotateEndContext,
  RotateMoveContext,
  RotateStartContext,
  SelectContext,
} from './interactivity/index.js';
export {
  GfxViewEventManager,
  GfxViewInteractionExtension,
  InteractivityExtension,
  InteractivityIdentifier,
  InteractivityManager,
} from './interactivity/index.js';
export { LayerManager, type ReorderingDirection } from './layer.js';
export type {
  GfxCompatibleInterface,
  GfxElementGeometry,
  GfxGroupCompatibleInterface,
  PointTestOptions,
} from './model/base.js';
export {
  gfxGroupCompatibleSymbol,
  isGfxGroupCompatibleModel,
} from './model/base.js';
export {
  GfxBlockElementModel,
  type GfxCommonBlockProps,
  GfxCompatibleBlockModel as GfxCompatible,
  type GfxCompatibleProps,
} from './model/gfx-block-model.js';
export { type GfxModel, isPrimitiveModel } from './model/model.js';
export {
  convert,
  convertProps,
  derive,
  field,
  getDerivedProps,
  getFieldPropsSet,
  getLocalPropsSet,
  initializeObservers,
  initializeWatchers,
  local,
  observe,
  updateDerivedProps,
  watch,
} from './model/surface/decorators/index.js';
export {
  type BaseElementProps,
  type ForeignInterchange,
  type InterchangeScope,
  GfxGroupLikeElementModel,
  GfxPrimitiveElementModel,
  type SerializedElement,
  type ValidationException,
} from './model/surface/element-model.js';
export {
  GfxLocalElementModel,
  prop,
} from './model/surface/local-element-model.js';
export {
  collectPivotOccurrences,
  isPivotBound,
  type PivotBoundElement,
  type PivotOccurrence,
  resolvePivotBinding,
} from './model/surface/pivot.js';
export {
  type EdgeDirectionDef,
  findRoleDef,
  isTypedEdgeRole,
  type RoleDef,
  type RoleDefs,
  type RoleId,
  roleIsA,
  type RoleKind,
  RoleVocabularyExtension,
  RoleVocabularyIdentifier,
} from './model/surface/role.js';
export {
  ELEMENT_TAGS_FIELD,
  type ElementTags,
  elementTagValues,
  hasElementTagValue,
  readElementTags,
  setElementTag,
  tagsPropToY,
} from './model/surface/tags.js';
export {
  SURFACE_TEXT_UNIQ_IDENTIFIER,
  SURFACE_YMAP_UNIQ_IDENTIFIER,
  SurfaceBlockModel,
  type SurfaceBlockProps,
  type SurfaceMiddleware,
} from './model/surface/surface-model.js';
export { measureOperation } from './perf.js';
export { GfxSelectionManager } from './selection.js';
export {
  SurfaceMiddlewareBuilder,
  SurfaceMiddlewareExtension,
} from './surface-middleware.js';
export {
  BaseTool,
  type ToolOptions,
  type ToolOptionWithType,
  type ToolType,
} from './tool/tool.js';
export { MouseButton, ToolController } from './tool/tool-controller.js';
export {
  type EventsHandlerMap,
  GfxElementModelView,
  type SupportedEvent,
} from './view/view.js';
export { ViewManager } from './view/view-manager.js';
export * from './viewport.js';
export { GfxViewportElement } from './viewport-element.js';
export { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
