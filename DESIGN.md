---
version: alpha
name: AcadeX
description: Mindoro State University's green academic capstone repository, refined without a rebrand.
colors:
  primary: "#5BBE63"
  institutionalGreen: "#1B5E20"
  darkBackground: "#121614"
  darkSurface: "#1c221e"
  lightBackground: "#F6FFF7"
  lightSurface: "#ffffff"
typography:
  sans:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
  display:
    fontFamily: "Poppins, sans-serif"
rounded:
  DEFAULT: "10px"
  panel: "14px"
spacing:
  sectionGap: "76px"
  pageMax: "1184px"
components:
  button:
    minHeight: "44px"
  input:
    minHeight: "42px"
  dialog:
    maxHeight: "calc(100dvh - 32px)"
---

# AcadeX design system

## Overview

### Creative North Star

A university library catalogue: an identifiable institution, a clearly described collection, readable research records, and familiar tools. The book hero is the characteristic artifact, explicitly retained at the user's request. No promotional counters, floating interface fragments, or repeating decorative motion are needed to make research credible.

### Product context and register

Students submit work, faculty review assigned submissions, administrators maintain the collection, and authenticated visitors discover permitted research. The audience is the Mindoro State University community in the Philippines; existing English language UI and role policies are retained. The public route introduces the repository; authenticated routes prioritize everyday tasks. This is a refinement of the existing green identity, not permission for a future rebrand.

The existing runtime source is canonical: `EduArchive-Frontend-React/src/index.css` owns theme colors, input colors, sidebar colors and shadow tokens. `src/refinements.css` owns shared sizing, public compositions and scoped workspace presentation. `ThemeContext` owns the persisted light/dark selection. This document records intent and the implemented values; no second generated token package is introduced.

## Colors

Keep primary green `#5BBE63`, institutional green `#1B5E20` and pale green light backgrounds. Solid surfaces replace translucent glass. In dark mode primary actions use the original bright green with forest text; in light mode the existing institutional green supports white labels. Links use readable green shades in each theme. Secondary/faint text and placeholders must stay readable; never use color alone to communicate approval or publication status. Semantic red, amber and blue remain for actual states, not arbitrary decoration.

**User-approved shared dark theme (November 1 continuation):** the landing page and all role workspaces use charcoal `#121614`, secondary `#191e1b`, surface `#1c221e`, neutral body text `#c0c7c2` and muted text `#9ca69f`. These values live in the canonical dark tokens in `src/index.css`, including navigation, form and assistant surfaces. Green remains in the wordmark, book, active navigation, actions and links (`#9bc5a0`). The book cover explicitly retains forest green `#153723`. Avoid glowing green backgrounds or a futuristic treatment. The light palette remains unchanged.

## Typography

Retain the installed Inter and Poppins families with system fallbacks. Poppins is reserved for public headings and workspace page titles. The official logo uses the supplied outlined typography and requires no font. Body and utility text use Inter. Public introductory text is 16px with generous line height; workspace text is generally 13–14px. Workspace page titles are 26px desktop and 23px mobile. Narrow-screen form controls are at least 16px. Avoid all-caps body copy, oversized headings and truncated dashboard metric labels. Allow long titles and filenames to wrap.

## Layout

Public content uses a 1184px maximum, with 32px side gutters (16–20px on phones). Desktop sections use 76px vertical padding, reduced to 48px on phones. The introduction pairs its purpose with an academic book illustration; the earlier sample-record panel was rejected and removed. Mobile recomposes the book into a compact visual alongside its caption, with a clear primary action above it. Features use three keyboard-operable paths for discovery, submission, and management. Process numbering is used only for the genuine submission sequence.

Role workspaces retain the established sidebar, collapsible navigation, top bar and content scroller. `WorkspaceSidebar.jsx` owns a 256px expanded desktop sidebar and a 72px collapsed rail, with centered 48px navigation targets, accessible names and native tooltips. Labels/account details disappear only in the desktop rail. The mobile drawer stays full width when opened and retains focus containment and Escape handling. Desktop collapse changes width without a layout animation. The shell uses `100dvh`; children must not create another full-screen-height page. The main scroller has stable scrollbar space. Grids account for the sidebar when choosing column counts. Real tables keep all columns and actions inside keyboard-reachable horizontal scroll regions. Do not hide overflow to mask layout bugs.

## Elevation & Depth

Use solid tonal layers, whitespace and borders first. Cards and dashboard panels do not rise on hover. Reserve modest shadows for overlays and menus. No ambient glow, animated blobs, floating cards, decorative progress percentages or fake usage statistics. Keep only animation that communicates an active state, such as an indeterminate loading spinner.

## Shapes

Controls use a 10px radius; panels and dialogs use 14px. Use the official graduation-cap/open-book logo from the client-supplied SVG pack. Preserve its outlined wordmark, geometry and colors. `Brand.jsx` selects the explicit application-theme variant; the light workspace sidebar uses the pack's white-lettered sidebar variant against institutional green. Public wordmarks are 140px wide and the narrow phone header uses 128px. Following the final sidebar feedback, the sidebar uses the exact same light/dark SVG wordmark as the landing page, scaled to 116px. On collapse, the image and scale stay unchanged; a 41px viewport hides the outlined wordmark and retains the original cap/open-book portion. No square app-icon substitution occurs. A theme-neutral inset keeps the landing artwork readable against the light theme's green sidebar. The home target remains at least 44px high. Pills are appropriate for keywords and meaningful status, not every caption. Dividers communicate groups and table rows.

## Components

### Foundational visual states

Interactive controls have hover, visible keyboard focus, active and disabled states. Loading regions retain a text description. Empty states explain the available next action. Error/success feedback has text and semantic live-region roles. Honor reduced motion and forced-colors settings. Scrollbars remain visible and operable.

### Buttons and actions

Use solid green for a page's main action, outline/neutral for alternatives and red only for destructive operations. Keep labels, handlers and existing permissions. Primary public buttons have a minimum 44px height. Icon-only actions need an accessible name. Submitting controls retain their existing duplicate-submission guards.

### Navigation and data display

Retain all route/role boundaries and existing filters, pagination, saved items, archives, approvals and analytics. Name navigation landmarks and provide skip links. On phones, the sidebar becomes a dismissible drawer with contained keyboard focus. Tables remain semantic tables; `table-scroll` regions provide explicit overflow ownership and keyboard access.

### Forms and overlays

Reuse existing form handlers and native validation where present. Native select/date controls retain platform-owned popups. `CategoryCombobox` and `SearchWithSuggestions` own their authored suggestion lists and keyboard behavior. Textareas retain vertical resizing to accommodate long academic text; this intentionally differs from the design skill's resize-none preference. Never remove validation merely to satisfy a static style convention.

`Modal` and `ConfirmDialog` share `useDialogFocus`, Escape handling, focus restoration and nested-layer ownership. Upload dialogs use that hook and retain the current busy/skip behavior. Confirmation initially focuses Cancel. Metadata labels are associated with fields. File selection checks the 128 MiB boundary before sending; the server remains authoritative. An indeterminate indicator must not claim a fabricated percentage.

At 320px, submission steps use three compact columns and the fixed footer retains two usable actions without covering form content. Moving from metadata review to Additional Info stores the reviewed draft in the previous history entry, so Back retains the user's corrections. Long record titles stack with their status on phones. The visitor saved panel supports the server's paginator, an explicit loading failure/retry state, keyboard cards and contained focus.

### Iconography

Use the existing `react-icons/hi` outline family for refinements. Existing compatible Heroicons SVGs remain for actions and document references. Official brand artwork lives in `src/assets/brand/`; the legacy document glyph is no longer a project logo. Presentation emojis are replaced with icons or clear text; research content returned by users is never rewritten to remove characters.

### Motion

Feedback transitions are about 150ms. No global transition on every node. No repeating decorative animations. The book has a small hover response only for a fine pointer with no reduced-motion preference. Active navigation and selectable repository paths communicate position and purpose. Reduced-motion preference suppresses animation and smooth scrolling.

### Content and data visualization

Use precise academic language. Describe extraction as suggestions requiring review; large files use a first-12-page sample. Do not promise instant, perfect, permanent or redundant preservation without evidence. Category remains a user selection. Charts retain their actual datasets and labels, with theme-compatible tooltips and text. Long PDF readers keep every page's text and annotation layers while `ViewportPdfPage.jsx` allocates canvases only near the viewport. Container ResizeObserver updates keep embedded/fullscreen pages fitted when the sidebar or viewport changes. No API or private-document response cache is introduced.

## Do's and Don'ts

- Do preserve the green identity and light/dark modes.
- Do make a long research title, keyboard navigation and narrow-screen tables work.
- Don't introduce decorative cards or repeated badges without a task-related purpose.
- Don't change server access, account approval, document download or submission rules for a visual preference.

Research references: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) guides reflow, focus and target-size checks. [MIT Libraries' thesis discovery guidance](https://libguides.mit.edu/dspace/about-theses) informed the emphasis on identifiable research collections and discovery, without copying its identity or claiming equivalent scale.
