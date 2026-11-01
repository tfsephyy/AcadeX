# Official logo, sidebar and performance implementation plan

Goal: apply the supplied Acadex SVG identity throughout the current UI, retain usable navigation when the desktop sidebar is collapsed, and reduce measured loading/rendering overhead while preserving the existing product and role policies.

Scope comes from the user's detailed November 1 request, `DESIGN.md`, `UX-CONTRACT.md`, and the current source. Existing uncommitted refinements remain in place. No production release, credentials, data migration, or backend behavior change is part of this implementation.

1. Record source/build baselines and browser cold-load measurements. Inspect the supplied SVG geometry, themes, safety, and actual references. Keep only used derivatives in runtime assets. Use explicit variants driven by the application theme; the light workspace has a dark green sidebar and needs the pack's sidebar variant.
2. Replace public/auth/sidebar/book branding and the starter favicon. Reuse outlined logo paths; preserve proportions and colors. Give images intrinsic dimensions. Remove confirmed unused starter SVG/CSS files.
3. Share the sidebar header/navigation/toggle between all four role layouts. Use a 72px desktop rail and 256px expanded width. Hide labels and account text only at desktop widths, keep icon targets centered, and retain accessible names/tooltips, active routes, account actions and notifications. Preserve the mobile drawer's focus containment, Escape handling and focus restoration. Avoid width animation/reflow on desktop.
4. Measure and defer unrelated authentication route code. Review font requests and dependencies. Optimize PDF page rendering only if a synthetic long document reproduces unnecessary initial canvas work; retain all pages, text/annotation layers, fullscreen, authorized retrieval, and document actions. Avoid adding a caching layer for private API/PDF data.
5. Validate production output, unit tests, quiet lint, and the guarded disposable backend suite. Test public/auth and every active role route in both themes, desktop expanded/collapsed navigation and mobile/tablet drawers. Exercise keyboard focus, tooltips, account/notification panels, PDFs/fullscreen, metadata navigation, responsive tables and error-free asset loading. Compare before/after browser measurements under identical conditions; document limits separately from results.

Local baselines and synthetic browser evidence live in ignored `.local/logo-performance-20261101/`. The final portable review belongs in `docs/ui/`. Production architecture/runbook remains unchanged.

Completed locally: see [the final verification report](2026-11-01-logo-performance-review.md) for measured results and acceptance boundaries. The client's subsequent request for a smaller logo is incorporated into the final sizes. No deployment, commit or push was performed.
