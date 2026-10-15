// The reader moved to the surface package so BPMN and the SVG sketch read with
// it too (ADR 0012, P3 as amended 2026-10-14); this keeps UML's public names.
export {
  decodeXmlText,
  readXml,
  serializeXmlNode,
  type XmlDocument,
  xmlAttr,
  xmlChild,
  xmlChildren,
  type XmlContent,
  xmlDescendants,
  xmlFragmentOf,
  xmlNamespaces,
  type XmlNode,
  type XmlReadOptions,
} from '@labre/affine-block-surface/interchange';
