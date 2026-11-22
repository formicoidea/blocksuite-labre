---
'@labre/affine-database-engine': minor
---

The table's "+" column now opens the property type picker, as the virtual
table, the properties list and the record detail already did: the column is
created only once a type is picked, and Escape or a click outside creates and
writes nothing.

The title editor that follows opens on the column the gesture added, once it
is drawn, never on "the last column next frame". A host whose data source
applies the add asynchronously (it reads its server first) saw the previous
column's editor open. The same wait now covers "Insert left / right" (classic,
virtual and mobile tables), the mobile "+" and the properties list's "New
property"; if the property never arrives, nothing opens.
