---
'@labre/affine-gfx-bpmn': patch
'@labre/affine': patch
---

feat(edgeless): a BPMN board leaves as a `.bpmn` file

Select a pool, open the "⋮" on its toolbar, and "Export BPMN XML" downloads the
board as a BPMN 2.0 interchange document — the semantic model and the BPMN DI
diagram in one file, which is what bpmn.io, Camunda Modeler, Signavio and every
other BPMN tool opens. A process drawn here is no longer only a picture of a
process.

It exports the WHOLE board, whichever pool's toolbar launched it. A BPMN
document is a process, and half a process is not a smaller process: a file
holding one participant of a two-participant collaboration would be a picture of
a conversation with one side deleted. The selected pool decides the filename and
nothing else — the document's own title first, the pool's name if it has none.

What comes out follows what is drawn. One pool or more gives a `collaboration`
with a `participant` and a `process` each, the message flows under the
collaboration where the spec puts them, and one extra participant-less process
for anything drawn outside every pool. No pool at all gives a single `process`
and no collaboration, which is what a process drawn without swimlanes IS. A
pool's lanes become a flat `laneSet`, and each artefact is listed in the lane it
is drawn in — the same centre-in-the-plot arithmetic the audit and the
validation rules already read, so the file and the badge on the canvas can never
disagree.

All seventeen artefacts map: the plain, message and timer starts, the plain,
message and terminate ends, the task, user task, service task, sub-process, call
activity, exclusive and parallel gateways, data object, data store, text
annotation and group. The four triggered events carry the event definition the
spec asks for rather than becoming elements of their own; a data object arrives
with the `dataObjectReference` that DI attaches to; a group carries its label on
a `categoryValue`, which is where BPMN keeps the words a group shows.

**The export speaks only what the author stated.** A connector with no BPMN role
relates nothing, so it is not an untyped sequence flow — it is not a flow, and
it is absent. So is a plain rectangle drawn beside a pool, and so is an arrow
with a free end, which the format has no way to write down: `sourceRef` and
`targetRef` are required on every flow. Guessing here would put words in an
architect's mouth in a file they are about to hand to an execution engine.

Two limits worth knowing before the first import. A data association is exported
as a plain `association`, not as the `dataInputAssociation` / `dataOutputAssociation`
pair — those drag in an `ioSpecification`, a `dataInput`, a `dataOutput`, an
`inputSet` and an `outputSet` per arrow, which the Descriptive conformance
sub-class does not ask for. And a message flow drawn on a board with no pool is
dropped rather than demoted to a sequence flow: "sends a message to" and "is
followed by" are two different sentences.

The drawing is translated so its top-left sits at the origin. BPMN DI
coordinates are relative to the plane and the canvas lets you drag left of zero;
a tool that clamps at zero would otherwise fold half the process onto its own
edge.

The serializer is a pure function — element models in, XML string out, no editor
anywhere near it — and is exported from the package, so a host can serialize a
board it never rendered.
