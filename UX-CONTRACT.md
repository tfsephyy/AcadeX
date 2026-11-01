# AcadeX interface behavior contract

The November 1 interface is deployed as documented in the [current release and verification report](docs/handoff/UI_RELEASE_2026-11-01.md). It preserves the existing API, business rules and [document access policy](docs/ACADEX_ACCESS_POLICY.md); server permissions remain authoritative. The earlier continuation used the actual local Laravel API with synthetic accounts/documents in the schema-restricted disposable database; see [role and mobile verification](docs/ui/2026-11-01-role-mobile-verification.md). The current release adds fresh production acceptance and final logo/upload-feedback checks. Earlier fixture-only evidence remains historical.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Brand / Navigation | Brand.jsx; WorkspaceSidebar.jsx | Client-supplied SVG pack, application theme, DESIGN.md | Light/dark public logo; white sidebar logo on green; desktop icon rail; mobile drawer | [Logo/sidebar/performance review](docs/ui/2026-11-01-logo-performance-review.md) |
| Table Selection | Existing owning page state where selection exists | Existing API/page flow | Existing page selection only | Local browser review; no new bulk behavior |
| Select/Listbox | Native selects; CategoryCombobox and SearchWithSuggestions for suggestions | Existing forms plus DESIGN.md | Platform-native popup; authored category/search lists | Arrow keys, Enter, Escape and open popup on narrow screens |
| Date | Existing native date inputs | Existing form/API contract | Platform-native dates | Retained values and keyboard navigation |
| Form | Existing page handlers and validation; shared input tokens | Existing required fields and API errors | Login, registration, profile, upload, metadata, edit | Validation, preserved input, upload navigation |
| Scrollbar | index.css tokens and refinements.css baseline | DESIGN.md | Main content, table, modal geometry | Reflow and keyboard scrolling |
| Toast | NotificationProvider | Existing notify API | Success, error, information | Live regions, dismiss button, narrow viewport |
| CRUD | Existing route/page and API modules | Access policy and server contract | Existing role-specific create/edit/archive/delete/review | Actual local API: three role upload/submission flows, faculty approval, visitor saved items; no production mutations |

## Invariants

- Keep existing route destinations, role guards, API calls, payloads, document references and approval/publication distinctions.
- Preserve all useful actions, filters, table columns, citations, supporting documents, analytics and assistant functions. Destructive actions retain their confirmations.
- Keep selected light/dark mode across navigation. Logo and favicon variants follow that explicit app setting, even when the device theme differs. Collapsed desktop navigation retains every role destination and accessible name; mobile drawers retain full labels. Show no user statistics without a real data source.
- The user approved extending the landing charcoal dark theme throughout the application. Canonical tokens, green identity and the book hero are preserved; no second theme implementation is introduced.
- Back from Additional Info restores reviewed metadata. The visitor saved list retains pagination and reports loading failure instead of showing an empty success state.
- Shared dialogs contain focus, close with Escape when closable, and return focus to their opener. Busy uploads preserve the existing close restriction. Nested dialogs retain one active focus owner.
- Search clearing must cancel pending debounce/suggestion work, clear results immediately and return focus. IME composition must not submit partial input. Stale suggestion responses may not overwrite newer ones.
- Category entry retains both choosing an existing option and typing a new custom value.
- Browser-native validation and vertically resizable academic text areas are intentional existing behavior. Do not disable/remove them without equivalent accessible validation or text expansion.
- UI review may use a separate loopback-only fixture API or the real API connected to the approved disposable schema. Identify the source in the verification report. Database tests must use the schema-restricted disposable credentials and private test storage/mail; never the normal local or production database.

## Scope boundaries

No backend source behavior, permissions, account approval, encryption, production storage or deployment is changed for this UI task. The separately requested local login repair corrected the ignored `.env` to the existing `acadex_local` schema and applied four already-existing pending migrations after a private backup. The existing application key and original user were preserved. Production remains on the previously verified metadata release; this review makes no new live-health claim. Physical-device and full assistive-technology certification require separate acceptance testing.
