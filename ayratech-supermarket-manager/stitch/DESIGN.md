# Design System Document

## 1. Overview & Creative North Star
### Creative North Star: "The Luminescent Engine"
This design system is built to transform a traditional management interface into a high-octane, futuristic command center. It moves away from the static "dashboard-in-a-box" approach toward a **Luminescent Engine**—an interface that feels powered from within, characterized by deep tonal depth, radiant energy, and precision-engineered typography.

We break the "template" look by favoring **intentional asymmetry** and **tonal layering** over rigid grids and borders. Inspired by the Ayra Tech gear logo, components utilize circular geometry and radial energy. The goal is an editorial-grade management system where high-tech utility meets premium aesthetic polish.

---

## 2. Colors
Our palette is anchored in a high-contrast relationship between deep charcoal voids and vibrant neon energy.

### Core Tones
- **Background (`#0e0e0e`):** The absolute foundation. A deep, infinite canvas that allows neon accents to pop.
- **Primary (`#cc97ff` / `#c284ff`):** Our signature Purple Neon. Use this for the most critical actions and brand markers.
- **Secondary (`#53ddfc`):** The Cyan Highlight. Used for secondary data points and tech-inspired accents.
- **Tertiary (`#ff6daf`):** The Pink Highlight. Reserved for high-alert items or unique interactive status indicators.

### The Rules of Engagement
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. We define space through background shifts. For example, a card (`surface-container-highest`) sits on a workspace (`surface-container-low`), which sits on the global background (`surface`).
*   **The "Glass & Gradient" Rule:** Primary buttons and hero cards must utilize a subtle gradient transition (e.g., `primary` to `primary_dim`) to provide a sense of "soul" and volume.
*   **Surface Hierarchy:** Use the five tiers of `surface-container` (Lowest to Highest) to create nested depth. The "inner" a component is, the "brighter" its surface becomes, simulating light reflecting off layered glass.

---

## 3. Typography
The system uses a dual-typeface approach to balance technical precision with modern editorial flair.

### Typeface Selection
*   **Display & Headlines:** `Space Grotesk`. A typeface that echoes the geometric precision of the Ayra Tech gear. It is used for large-scale statements to convey a "high-tech" professional vibe.
*   **Body & Labels:** `Inter`. Chosen for its extreme readability in data-heavy management environments.

### The Scale
- **Display-LG (3.5rem):** Reserved for hero metrics or high-impact landing states.
- **Headline-MD (1.75rem):** Primary section headers.
- **Title-SM (1rem):** Used for card titles and prominent navigation links.
- **Body-MD (0.875rem):** The workhorse for all data entry and descriptive text.
- **Label-SM (0.6875rem):** Micro-copy, metadata, and technical "gear" details.

---

## 4. Elevation & Depth
In this system, elevation is an optical illusion created by light and tone, not by structural lines.

### Tonal Layering Principle
Depth is achieved by stacking `surface-container` tiers. 
1.  **Level 0 (Base):** `surface` (`#0e0e0e`).
2.  **Level 1 (Sections):** `surface-container-low` (`#131313`).
3.  **Level 2 (Cards):** `surface-container-highest` (`#262626`).

### Ambient Shadows & Neon Glow
*   **Floating Elements:** Use extra-diffused shadows with a blur radius of 24px–48px at 6% opacity.
*   **The Neon Pulse:** Active states or high-priority notifications should use a `primary` glow (`drop-shadow`) with a 10px spread and 20% opacity to mimic the "Neon Dark" aesthetic.
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use `outline_variant` at **15% opacity**. Never use 100% opaque lines.

---

## 5. Components

### Buttons (The "Engine" Switches)
*   **Primary:** Solid `primary` gradient with `on_primary` text. Apply a subtle outer glow of the same color on hover.
*   **Secondary:** Glassmorphic fill (`surface_variant` at 40% opacity) with a `primary` ghost border.
*   **Roundedness:** All buttons use the `md` (0.75rem) or `full` (pill) scale to echo the gear’s circular paths.

### Input Fields
*   **Styling:** Forgo the "box" look. Use a `surface-container-highest` background with a `label-sm` floating above it.
*   **Active State:** The bottom edge glows with a 2px `secondary` (Cyan) line.

### Cards & Data Lists
*   **Cards:** No borders. Use `surface-container-highest` with `xl` (1.5rem) corner radius. 
*   **List Separation:** Strictly forbid divider lines. Use **16px (1rem)** of vertical white space or a slight hover-state background shift to `surface_bright` to separate items.

### The "Ayra Tech" Specialty Components
*   **Radial Progress:** Inspired by the logo gear, use circular progress indicators for system health or task completion, utilizing the `secondary` (Cyan) and `tertiary` (Pink) highlights.
*   **Luminescent Chips:** Small status indicators using `surface_container_highest` with a small, glowing `primary` dot.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts. Let a sidebar overlap a main content area with a backdrop-blur.
*   **Do** utilize `Space Grotesk` in all-caps for labels (`label-sm`) to lean into the technical aesthetic.
*   **Do** prioritize "Breathing Room." Use the `16` (4rem) spacing token between major sections to maintain a premium feel.
*   **Do** ensure "Clean White" mode maintains the purple accents for professional continuity while swapping `surface` for light grays.

### Don't
*   **Don't** use pure `#000000` for containers; it kills the "Neon" depth. Always use the `surface` tokens.
*   **Don't** use standard "Drop Shadows" (dark, harsh, or tight). Our shadows are ambient and tinted.
*   **Don't** use more than three neon colors in a single view. Stick to Purple/Cyan or Purple/Pink to prevent a "circus" look.
*   **Don't** use dividers. If the content feels cluttered, increase the spacing scale or shift the surface tier.