import type { UmlModel } from './model.js';
import { exportPlantuml } from './plantuml.js';
import { exportXmi } from './xmi.js';

/**
 * The glue between the models and the two writers — what the interchange
 * capabilities and the commands both call.
 *
 * Twenty lines and no cleverness, which is the point: there is ONE place that
 * decides what several selected diagrams mean for each format, so the command
 * and the registry cannot produce different bytes. The formats answer that
 * question differently, and the difference is theirs rather than ours:
 *
 *  - **PlantUML renders one diagram per document.** `@startuml … @enduml` is a
 *    picture; two of them in one file is two pictures, which every renderer in
 *    the ecosystem handles by drawing them in sequence. So several diagrams are
 *    several documents, concatenated.
 *  - **XMI carries one model.** Four sheets of one architecture are four
 *    packages of one `uml:Model`, not four files — and writing them as four
 *    would lose the fact that a class on one sheet is the class on another.
 *
 * Pure: models in, a string and its warnings out. No `std`, no DOM, no clock —
 * `docs/adr/0012` P3.
 */

/** A document, plus what the writer could not say about the drawing. */
export interface UmlExportResult {
  text: string;
  /**
   * One line each, in the user's words, deduplicated.
   *
   * Deduplicated because the warnings are a SENTENCE about a kind of loss, not
   * a row per element: three untyped connectors on one board produce one line
   * telling the author what to do about all three. A per-element list would need
   * names the exporter does not have (a connector has no name) and would read as
   * a stack trace.
   */
  warnings: string[];
}

export interface UmlExportOptions {
  /** The name the document takes — the board's title, already sanitized. */
  name?: string;
}

/** Every warning the models collected, in order, without repeats. */
function warningsOf(models: readonly UmlModel[]): string[] {
  return [...new Set(models.flatMap(model => model.warnings))];
}

/**
 * The diagrams as PlantUML — one `@startuml … @enduml` document each.
 *
 * Takes no name, where the XMI writer does: a PlantUML `title` is the DIAGRAM's
 * own heading — `class Orders`, the frame tag of Annex A — and the file's name
 * is a different fact about a different thing. Overriding one with the other
 * would drop the kind tag, which is the half of the heading a `.puml` has
 * nowhere else to put.
 *
 * No diagram is not an error: it is a selection nobody made a statement with,
 * and the honest answer is the smallest document that still parses. The same
 * reading `exportC4Mermaid` gives an empty board.
 */
export function exportUmlPlantuml(
  models: readonly UmlModel[]
): UmlExportResult {
  if (models.length === 0) {
    return { text: '@startuml\n@enduml\n', warnings: [] };
  }
  return {
    text: models.map(model => exportPlantuml(model)).join('\n'),
    warnings: warningsOf(models),
  };
}

/**
 * The diagrams as one XMI document — one `uml:Model`, one package per diagram.
 *
 * The caller's `name` names the MODEL rather than any package, because that is
 * what it is: the document's own name, the board title the user exported under.
 * Each package keeps the name of the diagram it was drawn as.
 */
export function exportUmlXmi(
  models: readonly UmlModel[],
  options: UmlExportOptions = {}
): UmlExportResult {
  return {
    text: exportXmi(models, options),
    warnings: warningsOf(models),
  };
}
