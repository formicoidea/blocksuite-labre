---
'@labre/affine': major
---

The calendar view is removed (ADR 0035, amendment of 2026-10-29; product owner decision). `view-presets/calendar` of `@labre/affine-database-engine` is deleted with everything it exported: `calendarViewMeta`, `calendarViewModel`, `CalendarSingleView`, `CalendarExternalSourceProvider`, the calendar layout helpers and the `affine-data-view-calendar` element, plus `viewPresets.calendarViewMeta`, the conversions out of calendar and the key `com.labre.data-view.view.default-name.calendar`. A host that imported one gets a compile error: drop the import. Stored documents are untouched: a stored `calendar` view now takes the unknown-view path, drawn as a table tagged "Shown as a table", its settings read-only, its stored data never rewritten, "Duplicate as table" as the way out. It never throws.
