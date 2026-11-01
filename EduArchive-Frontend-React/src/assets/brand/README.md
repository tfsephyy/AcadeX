# Official Acadex artwork

Source: the client's `acadex-svg-pack.zip`, supplied November 1, 2026. These five runtime variants retain the pack's graduation cap, open book, outlined lettering, colors and proportions. Unused automatic/symbol exports remain in the original archive rather than the runtime bundle.

`Brand.jsx` chooses light/dark variants from the application's saved theme, independently of the device preference. The sidebar uses the same light/dark wordmark as the landing page, at 116px. On collapse, its SVG and scale remain unchanged; a 41px viewport hides only the wordmark portion and retains the cap/open-book symbol. The supplied white-lettered wordmark is retained as a supported pack variant. The app icon serves collapsed navigation, the book imprint and favicon. `ThemeContext.jsx` keeps the favicon and browser theme color in sync.

Optimization removes comments/whitespace and rounds path coordinates to three decimal places. The maximum measured coordinate deviation is 0.0005 SVG units; icon paths are unchanged. Every SVG is self-contained, with no scripts, external resources, embedded raster image or font requirement. Vite emits hashed SVG files for reusable cached assets. Keep `?no-inline` imports consistent across consumers.

The user requested a smaller, quieter logo after the first visual review: 140px public/auth wordmark, 128px narrow header, a 24px book imprint (16px on phones), and a 116px sidebar wordmark with the same artwork/scale retained in a 41px symbol viewport on collapse. The role caption hides on collapse and the home link retains a 44px minimum height.
