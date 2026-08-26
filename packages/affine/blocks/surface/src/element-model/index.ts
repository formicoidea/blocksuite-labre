import {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  BrushElementModel,
  ConnectorElementModel,
  ContextMapBoardElementModel,
  CoreDomainChartElementModel,
  CynefinElementModel,
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
  EdgyNodeElementModel,
  EstuarineElementModel,
  EventStormingBoardElementModel,
  GroupElementModel,
  HighlighterElementModel,
  MindmapElementModel,
  ShapeElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';

import { SurfaceElementModel } from './base.js';

export const elementsCtorMap = {
  group: GroupElementModel,
  connector: ConnectorElementModel,
  shape: ShapeElementModel,
  brush: BrushElementModel,
  text: TextElementModel,
  mindmap: MindmapElementModel,
  highlighter: HighlighterElementModel,
  wardley: WardleyBackgroundElementModel,
  wardleyNode: WardleyNodeElementModel,
  edgy: EdgyFacetsElementModel,
  edgyBoard: EdgyBoardElementModel,
  edgyNode: EdgyNodeElementModel,
  cynefin: CynefinElementModel,
  estuarine: EstuarineElementModel,
  coreDomain: CoreDomainChartElementModel,
  contextMap: ContextMapBoardElementModel,
  eventStorming: EventStormingBoardElementModel,
  bpmnNode: BpmnNodeElementModel,
  bpmnPool: BpmnPoolElementModel,
};

export {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  BrushElementModel,
  ConnectorElementModel,
  ContextMapBoardElementModel,
  CoreDomainChartElementModel,
  CynefinElementModel,
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
  EdgyNodeElementModel,
  EstuarineElementModel,
  EventStormingBoardElementModel,
  GroupElementModel,
  HighlighterElementModel,
  MindmapElementModel,
  ShapeElementModel,
  SurfaceElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
  WardleyNodeElementModel,
};

export enum CanvasElementType {
  BRUSH = 'brush',
  CONNECTOR = 'connector',
  GROUP = 'group',
  MINDMAP = 'mindmap',
  SHAPE = 'shape',
  TEXT = 'text',
  HIGHLIGHTER = 'highlighter',
  WARDLEY = 'wardley',
  WARDLEYNODE = 'wardleyNode',
  EDGY = 'edgy',
  EDGYBOARD = 'edgyBoard',
  EDGYNODE = 'edgyNode',
  CYNEFIN = 'cynefin',
  ESTUARINE = 'estuarine',
  COREDOMAIN = 'coreDomain',
  CONTEXTMAP = 'contextMap',
  EVENTSTORMING = 'eventStorming',
  BPMNNODE = 'bpmnNode',
  BPMNPOOL = 'bpmnPool',
}

export type ElementModelMap = {
  ['shape']: ShapeElementModel;
  ['brush']: BrushElementModel;
  ['connector']: ConnectorElementModel;
  ['text']: TextElementModel;
  ['group']: GroupElementModel;
  ['mindmap']: MindmapElementModel;
  ['highlighter']: HighlighterElementModel;
  ['wardley']: WardleyBackgroundElementModel;
  ['wardleyNode']: WardleyNodeElementModel;
  ['edgy']: EdgyFacetsElementModel;
  ['edgyBoard']: EdgyBoardElementModel;
  ['edgyNode']: EdgyNodeElementModel;
  ['cynefin']: CynefinElementModel;
  ['estuarine']: EstuarineElementModel;
  ['coreDomain']: CoreDomainChartElementModel;
  ['contextMap']: ContextMapBoardElementModel;
  ['eventStorming']: EventStormingBoardElementModel;
  ['bpmnNode']: BpmnNodeElementModel;
  ['bpmnPool']: BpmnPoolElementModel;
};

export function isCanvasElementType(type: string): type is CanvasElementType {
  return type.toLocaleUpperCase() in CanvasElementType;
}
