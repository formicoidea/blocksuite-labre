import {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  BrushElementModel,
  C4BoardElementModel,
  C4BoundaryElementModel,
  C4NodeElementModel,
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
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlNodeElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
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
  c4Node: C4NodeElementModel,
  c4Board: C4BoardElementModel,
  c4Boundary: C4BoundaryElementModel,
  umlNode: UmlNodeElementModel,
  umlDiagram: UmlDiagramElementModel,
  umlSubject: UmlSubjectElementModel,
  umlPartition: UmlPartitionElementModel,
  umlRegion: UmlRegionElementModel,
  umlFragment: UmlFragmentElementModel,
};

export {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  BrushElementModel,
  C4BoardElementModel,
  C4BoundaryElementModel,
  C4NodeElementModel,
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
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlNodeElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
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
  C4NODE = 'c4Node',
  C4BOARD = 'c4Board',
  C4BOUNDARY = 'c4Boundary',
  UMLNODE = 'umlNode',
  UMLDIAGRAM = 'umlDiagram',
  UMLSUBJECT = 'umlSubject',
  UMLPARTITION = 'umlPartition',
  UMLREGION = 'umlRegion',
  UMLFRAGMENT = 'umlFragment',
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
  ['c4Node']: C4NodeElementModel;
  ['c4Board']: C4BoardElementModel;
  ['c4Boundary']: C4BoundaryElementModel;
  ['umlNode']: UmlNodeElementModel;
  ['umlDiagram']: UmlDiagramElementModel;
  ['umlSubject']: UmlSubjectElementModel;
  ['umlPartition']: UmlPartitionElementModel;
  ['umlRegion']: UmlRegionElementModel;
  ['umlFragment']: UmlFragmentElementModel;
};

export function isCanvasElementType(type: string): type is CanvasElementType {
  return type.toLocaleUpperCase() in CanvasElementType;
}
