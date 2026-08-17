# Garfbargle OS Design Language

**Status:** Canonical visual and interaction specification  
**Applies to:** Garfbargle desktop, tablet, and phone applications  
**Reference implementation:** Fiddler is the closest current visual reference, but this document—not any one app—is the authority.

## 1. Goal

Every Garfbargle app should feel like a first-party application from the same operating system.

The apps may have different purposes, content, icons, illustrations, and optional tint colors, but the **system chrome** should feel shared: the same materials, geometry, typography, controls, interaction states, motion, and responsive behavior.

The governing idea is:

> **Same OS, different apps. Glass is the material; tint is the personality.**

## Visual reference

![Garfbargle OS design system reference](assets/garfbargle-os-style-reference.png)

This image is illustrative, not pixel-law. The semantic rules in this document are authoritative when the image and text differ.

## 2. What the OS owns vs. what the app owns

### OS-owned

The shared design system owns:

- window and navigation chrome
- glass/material hierarchy
- spacing and radii
- UI typography
- buttons and icon buttons
- search fields and segmented controls
- menus, popovers, dialogs, sheets, notices, and toasts
- navigation rows and selection states
- focus, hover, pressed, selected, and disabled behavior
- motion
- touch sizing and responsive rules
- the tint derivation system

### App-owned

An app may own:

- domain-specific content
- illustrations and custom glyphs
- document/editor presentation
- data visualizations
- app-specific content themes or styles
- a preferred default tint

App-owned content should sit *inside* the OS language rather than redefining the OS chrome.

## 3. Material language

Garfbargle OS uses glass as a structural material, not as decoration.

Use four semantic material levels:

- `material.content` — the large content plane; calm and mostly opaque
- `material.chrome` — sidebars, top bars, navigation; translucent and blurred
- `material.raised` — cards, controls, floating toolbars, menus; slightly stronger material
- `material.opaque` — fallback or content that requires maximum readability

Large areas should not be extremely transparent. The desktop or background may influence the UI, but text and controls must remain easy to read.

Blur is used where it communicates layering. Do not put every card inside an exaggerated frosted-glass panel.

When blur is unavailable, use an opaque or near-opaque equivalent without changing the hierarchy.

## 4. Tint system

### 4.1 One system tint

There is one primary tint variable:

```text
system.tint = #0A84FF
```

Blue is the default Garfbargle tint. An app may declare a different default, and a user-facing theme system may allow it to be changed.

Changing the tint must not require editing individual components.

### 4.2 Tint influences more than buttons

Tint is not only an accent color. It should subtly influence the entire system material stack.

Derive at least these semantic roles from `system.tint`:

```text
accent.primary
accent.hover
accent.pressed
accent.selection
accent.focus

tint.chrome
tint.surface
tint.control
tint.glow
```

Typical intent:

- `accent.primary` — full-strength actions and active controls
- `accent.selection` — low-opacity selection wash
- `accent.focus` — focus ring
- `tint.chrome` — extremely subtle hue in glass chrome
- `tint.surface` — barely perceptible hue in raised surfaces
- `tint.control` — subtle hue in active/hover control material
- `tint.glow` — restrained accent-colored elevation or emphasis

The neutral palette must remain dominant. Tint should make the whole app feel related without turning every surface blue, green, or purple.

### 4.3 Semantic colors are not tint

Danger, warning, success, and other semantic states keep their semantic meaning. Do not recolor errors blue because the system tint is blue.

## 5. Apps with their own style/theme system

An app may have content styles independent from the OS tint. Papyrus is the model for this distinction: the notebook/document style is content; the surrounding controls are OS chrome.

Every content style should declare a tint policy:

```text
contentTint: none | accent | wash
```

- `none` — the content palette remains completely style-owned; only OS chrome uses the system tint.
- `accent` — links, caret, selection, checkmarks, and similar interactive content use the system tint, while the content background and ink remain style-owned.
- `wash` — the style also allows a very subtle tint influence on its content surfaces while preserving its base character.

A style may optionally declare a `tintStrength` from `0` to `1`.

This lets a parchment style remain warm parchment, a dark style remain dark, and a strongly authored palette remain recognizable while still belonging to the same OS.

**Do not replace every app/content-theme accent with the system tint unconditionally.** The relationship must be explicit through the tint policy.

## 6. Geometry

Use one shared radius scale:

```text
radius.small   = 8
radius.control = 12
radius.surface = 16
radius.hero    = 22
radius.pill    = full
```

Use a restrained spacing scale rather than arbitrary one-off values:

```text
4, 8, 12, 16, 20, 24, 32
```

The visual language should feel rounded and tactile, but not bubbly.

## 7. Control sizing

### 7.1 Desktop / precise pointer

Compact desktop controls are intentional:

```text
compact icon button: 34×34
regular control:     36–40 high
```

This is appropriate when a mouse/trackpad is the primary input.

### 7.2 Phone and tablet / touch

Touch interfaces do **not** inherit desktop control dimensions.

Garfbargle OS rule:

```text
touch target minimum:       48×48
touch icon-button shape:    at least 44×44
touch text/button height:   48 minimum
prominent touch action:     52–56 high
```

Icons inside touch controls are normally around `18–22` rather than being tiny desktop glyphs inside a larger empty hitbox.

This rule applies especially to:

- back/navigation buttons
- share
- more/overflow
- close
- add/create
- toolbar actions
- bottom navigation
- floating actions

**Never ship 34×34 desktop icon buttons unchanged in a phone or tablet toolbar.**

Input modality should drive sizing. Prefer an explicit touch/coarse-pointer mode over assuming that every narrow viewport is touch-only.

## 8. Responsive behavior

Responsive design should preserve importance, not shrink everything until it fits.

When space becomes constrained:

1. keep primary navigation and primary actions full-sized
2. remove labels from obvious actions only when necessary
3. move lower-priority actions into an overflow menu
4. hide duplicated/nonessential controls
5. never solve crowding by making touch targets smaller

Phone toolbars should generally show only the most important actions and put the rest behind More.

Tablet layouts may expose more actions, but touch sizing remains touch sizing.

Hover-only discovery is allowed on pointer devices only. Any action required to use the product must remain discoverable on touch.

## 9. Typography

Use the platform/system UI font for OS chrome whenever practical.

Suggested roles:

```text
caption       10–11
meta          11–12
body          13–14 desktop / 15–16 touch
label         12–14 desktop / 15–16 touch
title         24–30
mono          platform monospace
```

Typography should feel compact and confident. Secondary and tertiary text should become quieter through contrast before becoming dramatically smaller.

Content typography may be app-owned. For example, Papyrus can use its selected notebook font inside the document while the surrounding controls remain system UI typography.

## 10. Interaction states

Every interactive primitive must define:

```text
rest
hover          (pointer environments)
pressed
selected
focus-visible
disabled
destructive    (when applicable)
```

Selected controls generally use a tint wash rather than a solid saturated block.

Focus uses the system tint and must remain visible against both light and dark materials.

Pressed states should feel tactile through a small material/opacity/scale change.

## 11. Motion

Use a small shared motion vocabulary:

```text
motion.fast     = 130ms
motion.standard = 220ms
motion.ease     = cubic-bezier(.22, 1, .36, 1)
motion.spring   = cubic-bezier(.34, 1.4, .64, 1)
```

Motion should communicate state and hierarchy, not decorate the interface.

Respect reduced-motion preferences.

## 12. Required shared primitives

Apps should prefer shared semantic primitives over locally styled raw controls.

At minimum, implementations should provide equivalents of:

```text
SystemButton
SystemIconButton
SystemSearchField
SystemSegmentedControl
SystemNavItem
SystemCard
SystemToolbar
SystemSidebar / NavigationRail
SystemMenu
SystemDialog / SystemSheet
SystemNotice
SystemToast
SystemEmptyState
```

Each primitive should consume semantic tokens and support the current input mode (`pointer` or `touch`).

## 13. Token contract

Implementations may use CSS variables, Compose tokens, Swift values, or another platform-native representation, but the semantic contract should remain recognizable:

```text
material.content
material.chrome
material.raised
material.opaque

text.primary
text.secondary
text.tertiary

border.subtle
border.standard

control.fill
control.hover
control.pressed

system.tint
accent.primary
accent.hover
accent.pressed
accent.selection
accent.focus

tint.chrome
tint.surface
tint.control
tint.glow

radius.small
radius.control
radius.surface
radius.hero
radius.pill

controlSize.compact
controlSize.regular
controlSize.touch
controlSize.touchProminent

motion.fast
motion.standard
motion.ease
motion.spring
```

App code should not scatter literal colors, radii, control sizes, or motion timings when an appropriate semantic token exists.

## 14. Platform principle

The design language is semantic, not CSS-specific.

A Tauri/React implementation, an Android Compose implementation, and a future native implementation should all express the same hierarchy even when their underlying blur, elevation, typography, or safe-area mechanisms differ.

Use the platform's strengths rather than forcing pixel-identical rendering.

The test is not “are these screenshots identical?” The test is “do these feel like built-in apps from the same OS?”

## 15. App-specific defaults

Current intended family defaults:

```text
Garfbargle default  blue    #0A84FF
Fiddler             blue    default
Library             green   app default; user-swappable
Orbit               violet  app default; user-swappable
Papyrus             blue    OS chrome; content style controls tint participation
```

These are defaults, not separate design systems.

## 16. Review checklist

Before considering a UI makeover complete, verify:

- chrome uses the shared material hierarchy
- tint comes from one centralized source
- neutral surfaces remain dominant over tint
- all interactive states are defined
- phone/tablet actions use touch sizing
- back/share/more/close/add are not desktop-sized on touch
- responsive layouts shed low-priority controls rather than shrinking targets
- radii and spacing come from the shared scale
- app-specific content styles do not redefine system chrome
- content themes explicitly choose `none`, `accent`, or `wash` tint behavior
- semantic warning/error/success colors remain semantic
- reduced motion and no-blur fallbacks work

## 17. Instruction for coding agents

When modifying a Garfbargle application, treat this document as the visual authority. Preserve product behavior unless the task explicitly asks for behavioral changes. First normalize shared OS chrome and primitives, then adapt app-specific content. Do not invent a separate visual language for the repository.

When adapting an existing application, prefer incremental migration to shared tokens and primitives over a full rewrite.
