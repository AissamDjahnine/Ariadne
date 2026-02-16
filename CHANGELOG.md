# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-16

First working public version of ariadne.

### Added

- `[library]` Upload EPUB books, duplicate handling (ignore/replace/keep both), smart metadata parsing.
- `[library]` Grid/list views, sticky toolbar, quick filters, sorting, and reset filters.
- `[library]` Collections workspace (create/rename/delete, assign books, directory/detail + board layout).
- `[library]` Dedicated Notes and Highlights pages (separate from My Library view).
- `[library]` Continue Reading rail with progress and estimated time left.
- `[library]` Reading Snapshot and Reading Statistics views (including monthly reading heatmap).
- `[library]` Notification center with reading nudges and quick actions.
- `[reader]` EPUB reading in both Book view (paginated) and Infinite scrolling.
- `[reader]` Mandatory per-book mode choice on first open; in-progress mode lock with guided mode-change flow.
- `[reader]` Text settings panel (`Aa`): font size, font family, continuous line spacing, alignment, and page width control for infinite mode.
- `[reader]` Light, dark, and sepia themes; colorblind/daltonian palette toggle.
- `[reader]` Selection tools: highlight, dictionary, translate.
- `[reader]` Highlight workflows: recency-based color ordering, inline note prompt, edit/add note, delete + undo, export selections.
- `[reader]` Bookmarks panel with jump and delete.
- `[reader]` In-book search, annotation search, focused result navigation, and return-to-previous-spot chip.
- `[reader]` Footnote preview popup with direct jump to full note.
- `[search]` Global grouped search across books, notes, highlights, bookmarks, and content snippets.
- `[quality]` Fast unit/integration test layer with Vitest + React Testing Library.
- `[quality]` End-to-end coverage with Playwright and CI execution.

### Changed

- `[ux]` Unified feedback/toast behavior across reader actions.
- `[ux]` Improved icon tooltips and readability of reader controls.
- `[performance]` Search and rendering optimizations for larger libraries (indexing, lazy loading, render culling).
- `[quality]` E2E stability hardening (flow-choice modal handling, deterministic selection paths, CI-focused Playwright tuning).