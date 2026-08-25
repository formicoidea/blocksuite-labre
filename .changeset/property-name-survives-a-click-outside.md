---
'@labre/affine-components': patch
'@labre/data-view': patch
---

A property name typed in the menu survives the menu closing

Renaming a database/pivot property meant typing into the little input at the top
of the property menu. That input only handed its value back on an explicit
completion — Enter, or Escape. Dismiss the menu the way people actually dismiss
menus, by clicking somewhere else, and the typed name was thrown away: the
column kept its old title and the edit had to be done again, this time
remembering to press Enter.

Menu inputs now report on blur as well, and the property menu listens to that
report. Losing focus is a save, so the name is kept whichever way the menu goes
away. Mobile and desktop now follow the same path — the mobile branch used to
write on every keystroke, which made an abandoned edit unabandonable.

`menu.input` gains an optional `onBlur` callback; nothing that already passed
`onComplete` or `onChange` changes behaviour.
