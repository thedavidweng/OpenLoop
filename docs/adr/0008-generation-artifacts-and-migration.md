# ADR-0008: Multi-artifact Generation Records and native persistence

**Status:** Accepted for #261.

Completed Generation Records capture the common request, selected Engine/Runtime/
Model Pack/configuration, actual seed and adapter metadata. They own one or more
Artifacts: primary audio plus timed lyrics, MIDI, scores, stems or metadata when
supported. Missing files retain their Record until explicitly deleted.

Native GUI and CLI share the existing SQLite path. Add namespaced native tables
and import semantically valid legacy Settings, Projects and completed Records
once in a transaction. Preserve file paths, favorites, seed, engine parameters,
and raw provenance; legacy tables remain untouched for the migration boundary.
There is no simultaneous legacy/native synchronization. No unknown user files
are moved. Settings preserve legacy values without using obsolete launch commands.

Short SQLite transactions prevent whole-workspace overwrite across processes.
A process-held OS lease serializes execution; a lost lease on relaunch marks
interrupted running tasks failed/retryable. Each completed Take persists atomically.
All referenced artifact files are deleted only with explicit user confirmation;
shared files still referenced by another Record remain. Filesystem deletion and
SQLite are not one transaction: if deletion fails, retain Records so users can
retry, with missing-file semantics for already removed files.
