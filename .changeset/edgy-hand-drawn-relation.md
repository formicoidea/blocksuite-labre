---
'@labre/affine-gfx-edgy': minor
---

An EDGY relation drawn by hand names itself

The EDGY toolbox gains a **Relation** entry. Pick it, drag from one element to
another, and the link is typed: it carries the verb the metamodel gives that
pair — as a role the validation reads, and as the visible label the template
already puts on its own 24 links. "Process **realises** Capability", "Journey
**traverses** Channel", written by the tool, not by the user.

Until now those 24 typed relations could only be born of the "EDGY dynamic"
template. A practitioner drawing their own board had a plain connector: no verb,
no role, nothing the metamodel check could read. The vocabulary was there and
there was no way to speak it by hand.

**One entry, not twenty-two.** The metamodel's 24 relations run between 24
distinct ordered pairs of elements, so the verb is entirely determined by which
two elements the link ends up attached to — there is exactly one thing a link
from a Journey to a Channel can say. Offering a list of twenty-two verbs would
be asking a question the method already answers.

Three things it deliberately does not do:

- **it never turns a link round.** Draw a Channel → Journey link and it is named
  `traverses` all the same and left pointing the way it was drawn. The
  metamodel check then reports the sentence as one EDGY does not declare, and
  "Reverse direction" is one click away on the link's toolbar. Silently flipping
  a deliberate gesture would be the tool overruling the user; leaving the link
  anonymous would hide the mistake.
- **it never says anything about a pair the metamodel does not know**, and never
  about a link with an end on a People node, a base Object, a plain sticky or
  another framework's element. Outside the alphabet is outside the conversation.
- **it never rewrites a verb already there.** A relation is named once, on the
  way from the generic link to the verb, and never back. Move an end while the
  link is still anonymous and it is named again from the new pair; move an end
  after it has a verb and the verb stays — it is the user's statement by then.

Nothing is backfilled and nothing else changes: links drawn before this release
keep exactly what they carry, and a plain connector stays a plain connector.
