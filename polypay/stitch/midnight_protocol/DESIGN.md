# Design System Strategy: The Midnight Prism

## 1. Overview & Creative North Star
**Creative North Star: "The Veiled Vault"**

This design system moves beyond the "standard DeFi dashboard" by embracing the core philosophy of the Midnight blockchain: **Privacy through Sophistication.** 

The "Veiled Vault" aesthetic is rooted in high-end editorial layouts, utilizing deep tonal shifts and "ghostly" glassmorphism to imply security and exclusivity. We reject the rigid, boxy nature of traditional crypto interfaces in favor of **Organic Layering.** By using intentional asymmetry and a hyper-refined typography scale, we create a sense of quiet authority. This is not just a tool; it is a private, digital sanctuary for high-value assets.

---

## 2. Colors & Surface Philosophy
The palette is a journey through shadow and violet light. Every hex code is chosen to maintain low-light legibility while feeling "crypto-native."

### Surface Hierarchy & Nesting
To achieve a premium feel, we strictly follow **The "No-Line" Rule**: 1px solid borders for sectioning are prohibited. Boundaries must be defined through background color shifts.

- **The Foundation:** Use `surface` (#131318) for the global canvas.
- **The Navigation:** The sidebar resides on `surface_container_lowest` (#0e0e13) to anchor the layout.
- **The Workspace:** Use `surface_container` (#1f1f25) for main content areas.
- **The Focus:** Use `surface_container_highest` (#35343a) for interactive cards or active modals.

### The "Glass & Gradient" Rule
Standard flat containers feel "cheap." To elevate the experience:
- Use **Glassmorphism** for floating elements (like dropdowns or hovering tooltips). Apply `surface_variant` at 60% opacity with a `24px` backdrop blur.
- **Signature Textures:** Main Action buttons should not be flat. Use a linear gradient from `primary` (#d0bcff) to `primary_container` (#622ccc) at a 135-degree angle to provide "soul" and depth.

---

## 3. Typography
We use a tri-font system to create an editorial rhythm.

- **Display & Headlines (Manrope):** Chosen for its geometric but friendly curves. Use `display-lg` and `headline-md` with tightened letter-spacing (-0.02em) to create an authoritative, "newspaper-header" feel for balances and titles.
- **Body & Interface (Inter):** The workhorse. `body-md` is the standard for all functional text, ensuring high legibility against dark backgrounds.
- **Data & Monospace (Space Grotesk):** Used for `label-md` and `label-sm`. This provides the "crypto-native" feel necessary for hex strings, wallet addresses, and transaction hashes.

---

## 4. Elevation & Depth
Depth in this system is a result of **Tonal Layering**, not structural scaffolding.

- **The Layering Principle:** Place a card using `surface_container_low` on a `surface` background. The change in tone provides a "soft lift" that feels more integrated than a drop shadow.
- **Ambient Shadows:** For high-priority floating elements (e.g., a "Confirm Transaction" modal), use an ultra-diffused shadow: `0px 24px 48px rgba(0, 0, 0, 0.4)`. The shadow must never be pure black; it should feel like a deep violet-tinted mist.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline_variant` (#494456) at **15% opacity**. This creates a suggestion of a boundary rather than a hard wall.

---

## 5. Components

### The Signature Sidebar
A persistent, high-contrast element using `surface_container_lowest`. Icons should use `on_surface_variant`, switching to `primary` with a soft outer glow when active. No vertical dividers; use 24px of vertical spacing to separate groups.

### Primary Buttons
- **Style:** Gradient fill (`primary` to `primary_container`).
- **Corner Radius:** `xl` (1.5rem) for a pill-shaped, approachable feel.
- **Interaction:** On hover, increase the `surface_tint` overlay by 10% to "brighten" the button.

### Truncated Hex Displays
Wallet addresses and hashes are the soul of the app.
- **Container:** `surface_container_high` with a `sm` (0.25rem) radius.
- **Typography:** `label-md` (Space Grotesk).
- **Icon:** A minimalist "copy" icon in `secondary` (#c4c1fb) that triggers a "Copied!" tooltip in `tertiary`.

### Status Badges (The Traffic Light)
- **Pending:** `tertiary` (#ffb59a) text on a `tertiary_container` at 20% opacity.
- **Executed:** `Green` (Custom) - use a soft emerald glow.
- **Failed:** `error` (#ffb4ab) on `error_container` at 20% opacity.
*Note: Badges must use `full` (9999px) rounding.*

### Cards & Lists
**Forbid the use of divider lines.** To separate a list of transactions:
- Use `surface_container_low` for the list item.
- Use a `spacing-4` (1rem) gap between items.
- The "line" is created by the eye as it follows the negative space.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `20` (5rem) and `24` (6rem) spacing for major section breathing room. Editorial layouts need air.
- **Do** truncate hex strings to the first and last 4 characters (e.g., `0x1a...4f2e`).
- **Do** use `secondary_fixed_dim` for "read-only" data to differentiate it from interactive text.

### Don't
- **Don't** use 100% white (#FFFFFF). Use `on_surface` (#e4e1e9) to prevent eye strain on the dark background.
- **Don't** use "Drop Shadows" on cards that are part of the main grid. Only "floating" interactive elements get shadows.
- **Don't** use default Inter for wallet addresses. Always fall back to Space Grotesk for any alphanumeric data strings.