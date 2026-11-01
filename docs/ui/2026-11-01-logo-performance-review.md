# Official logo, sidebar and performance review — November 1, 2026

This report is the historical local review checkpoint. The [subsequent deployment report](../handoff/UI_RELEASE_2026-11-01.md) records the live release and the user's final sidebar correction: the landing-page SVG at 116px, with its same cap/book artwork retained on collapse. Earlier sidebar sizing/status descriptions below record the preceding review stage.

Status: **local production candidate verified; not deployed, committed or pushed**. The existing worktree refinements were preserved. Backend application source, production configuration, database, application key, encrypted documents and hosting architecture were unchanged.

## Official artwork and final sizing

The client supplied `acadex-svg-pack.zip`. All SVG exports were extracted and inspected; the selected variants were also rendered together against their intended backgrounds. Runtime assets use the original cap/open-book geometry, outlined lettering and green identity. Five variants are retained in `src/assets/brand/`: light/dark wordmarks, the white-lettered sidebar wordmark, and light/dark app icons. The automatic OS-theme and unused symbol exports are not added to the runtime.

`Brand.jsx` selects the logo using the explicit application theme. The light workspace retains its original institutional-green sidebar and uses the pack's white artwork. Public navigation, footer, desktop/mobile sign-in and registration, sidebar, book imprint, fallback page, and favicon use official artwork. The favicon and browser theme color follow the application's selected theme. The existing generic document icon in assistant research links remains an action/content icon, not project branding.

After the client's screenshot feedback, the public/auth wordmark was reduced from 168px to **140px** (about 17%). The narrow phone header uses **128px**, the expanded sidebar **144px**, and the book imprint **24px / 16px** on desktop/phone. Proportions are intrinsic, with no stretched artwork. The compact sidebar icon is 40px.

Comments and whitespace were removed from the SVGs and coordinate precision reduced to three decimals. Each wordmark changed from 6,266 to 4,064 bytes including the final newline; maximum measured coordinate deviation is 0.0005 SVG units. Icon paths are unchanged. No external image, script or font is embedded. Vite emits reusable hashed SVG files. The confirmed unused React SVG, Vite SVG and starter `App.css` were removed after replacing/checking their references.

## Sidebar behavior

All four role layouts use `WorkspaceSidebar.jsx`, preserving their original destinations, active states, account actions and administrator notifications.

- Desktop expanded width: **256px**. Collapsed rail: **72px**.
- Navigation targets stay **48px wide and at least 44px high**, with centered 20px icons.
- Navigation labels, role captions, account names/email and account chevrons disappear in the collapsed desktop rail. Accessible names and native hover tooltips remain.
- The compact home icon, navigation icons, account control and administrator notification control remain operable. Account menus open beside the rail and fit the viewport.
- Desktop width changes have no layout animation. Mobile/tablet keep a full labeled drawer with contained focus, Escape, overlay dismissal and focus restoration. Switching between drawer and desktop removes the mobile dialog state correctly.

## Measured performance changes

Authentication screens now use the existing React lazy/Suspense route pattern. Unrelated sign-in/registration UI is no longer included in the initial public JavaScript. This follows [React's lazy-loading contract](https://react.dev/reference/react/lazy). Existing role routes, chart splitting, parallel dashboard requests and server-paginated lists were already present and were retained after inspection. The unused `lucide-react` dependency was removed; no replacement dependency was added. The other runtime dependencies remain used.

The three PDF reader implementations now share `ViewportPdfPage.jsx`. Every page retains its searchable text and annotation/link layer, while only nearby pages allocate canvases. Canvas resources are released as pages leave the nearby region. The component uses actual page proportions once available. Container ResizeObserver measurements keep the embedded/fullscreen page widths current after sidebar changes as well as device resizing. Original PDF retrieval, permissions, text selection, links, fullscreen, citations and document actions remain in place. No private API/PDF cache or service worker was introduced.

| Measurement | Before | After | Meaning |
| --- | ---: | ---: | --- |
| Initial main JavaScript, uncompressed | 426,641 bytes | 377,889 bytes | **11.43% smaller** |
| Initial main JavaScript, gzip | 128,444 bytes | 118,384 bytes | **7.83% smaller** |
| Median script transfer including response overhead | 128,744 bytes | 118,684 bytes | Five cold runs per candidate |
| Median reported resource transfer | 154,705 bytes | 147,852 bytes | Includes the new logo requests; excludes the HTML document |
| Median first contentful paint / observed LCP | 2,128 ms | 2,064 ms | Modest local improvement; timing ranges overlap |
| Median observed layout shift | 0.000980 | 0.000738 | Both local measurements remain very small |
| Median observed long-task blocking sum | 260 ms | 260 ms | No demonstrated CPU-blocking improvement; this is not Lighthouse TBT or field INP |
| 30-page PDF: initial canvases | 30 | 1 | Same 1440 × 1000 viewport, DPR 1 |
| Same PDF: canvases with fullscreen open | 60 | 2 | Text layers remain present for all 30 pages in each view |
| Initial PDF canvas pixels | 17,329,680 | 577,656 | Allocated pixels, not a measured total-RAM claim |

Cold loads were interleaved (five before / five after), using fresh Chromium contexts with cache disabled, a 390 × 844 phone viewport, 4× CPU slowdown, 100ms latency and 200,000 bytes/second download throughput. Both builds used the same local gzip preview and isolated API. These are practical lab observations, not production network measurements, field Core Web Vitals or a Lighthouse certification. Browser scores and timings vary with conditions, as explained in [Chrome's performance measurement guidance](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring). At a 1440 × 900 viewport, the additional browser checks initially rendered two canvases rather than one; allocation depends on visible area and scroll position.

Fonts, useful chart/PDF dependencies, table columns and data controls were retained. There was no measured reason to replace them or introduce a more complex data/cache layer. Production static compression/cache headers must still be confirmed against the actual enabled Apache configuration during an authorized release; local preview headers do not prove server settings. Retain old hashed assets for open sessions as required by the existing client handoff.

## Fresh verification

| Check | Result and boundary |
| --- | --- |
| Production build | Passed with process-local `VITE_API_BASE_URL=/api/v1`; Vite 7.3.7 |
| Frontend unit suite | **12 passed**; extraction notices, hostile markdown, API-base safety, paginator normalization, PDF selection/128 MiB boundary |
| Quiet ESLint | Passed with no errors |
| Guarded Laravel suite | **75 tests / 705 assertions passed** against the approved schema-restricted disposable MySQL database |
| Role/theme/width review | **168 cases**: 21 active role routes × 320, 390, 768, 1440 CSS pixels × light/dark |
| Public/theme/width review | **32 settled cases**: landing, login, registration and the existing signed-out unknown-route redirect × four widths × two themes |
| Browser errors/assets/reflow | No horizontal page overflow, broken loaded logos, failed static requests, script errors or console warnings in the final 200-case matrix |
| Sidebar interactions | Passed for all roles: labels hidden only on desktop rail, centered targets, accessible names/tooltips, keyboard focus, account menus, expand/collapse, mobile focus/Escape/restoration and desktop/mobile resize; administrator notifications also passed |
| Explicit theme selection | Actual toggle changed logo/favicon, persisted on reload, and worked with a device preference opposite to the app theme |
| Actual upload workflows | Student, faculty and admin: choose synthetic PDF, upload/extract, verify five populated metadata controls, correct title/category, Next → Back retains corrections, Next → save succeeds, all at **320px**. Student adviser selection also passed |
| Other interaction checks | 320px user table retained horizontal keyboard scrolling; assistant returned the actual canned IMRAD answer; visitor saved a permitted record and opened/closed its saved panel through the actual API |
| Long-document browsers | Chromium: all four roles; Firefox and WebKit: student reader. Each passed 30 searchable pages, last-page scrolling, browser search, fullscreen/Escape, collapsed rail and 390px drawer/reflow. No script errors remained in the settled runs |
| Source/whitespace | Backend source unchanged; Git whitespace check passed using the repository's Windows line-ending settings |

Role routes covered: admin dashboard/users/library/uploads/approvals/logs/profile/detail; faculty uploads/library/approvals/profile/detail; student uploads/library/profile/detail; visitor collection/saved/profile/detail. The student attempt to enter admin users redirected to its permitted role route.

The initial backend run encountered old synthetic review accounts/pending uploads that violated tests' empty-fixture assumptions. The guarded disposable schema was checked for synthetic-only actors, privately snapshotted and cleared before rerunning. No test assertions or backend source were changed to obtain the passing result. The browser fixtures were then recreated in that disposable schema. The normal local application database and production were not test targets.

All normal route and upload checks used the **actual isolated Laravel HTTP API**. The separate 30-page reader stress check replaced only its synthetic PDF binary response in the test browser; metadata/auth/access routes still used the isolated API. This distinction matters: the stress results measure browser rendering, not server throughput for a large real document.

Ignored local evidence is under `.local/logo-performance-20261101/`, including `ui-results.json`, `cold-load-comparison.json`, `baseline-measurements.json`, `final-measurements.json`, `pdf-browser-results.json`, `workflow-results.json`, `final-smoke-results.json`, build/test logs and synthetic screenshots. Source/build baselines were retained privately for comparison. No real uploaded document was used.

## Acceptance boundary

This is a verified local release candidate, not a new live-service/deployment acceptance report. Physical phones, native iOS/Safari, full screen-reader certification, all destructive/account actions, live email/OCR-provider behavior, arbitrary huge-document/concurrent load and production caching were not certified by these checks. Browser-engine and responsive-width checks supplement those later acceptance steps. Production remains on its existing release; no deployment, migration, commit or push was performed for this task.
