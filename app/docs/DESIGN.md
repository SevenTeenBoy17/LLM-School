# EduAI Prism Teacher Workspace Design System

## Visual Direction

The teacher workspace adapts the best qualities of the Nunito Workspace reference: a softly tinted page canvas, lifted white work surfaces, clear blue actions, gentle diffusion shadows, and tactile press feedback. Layout and content remain native to EduAI Prism.

The interface is optimized for bright classrooms, offices, and shared school displays. It uses a light theme with stable contrast and avoids image-heavy decoration in dense operational areas.

## Surface Hierarchy

- Canvas: cool lavender-gray, visually quieter than content surfaces.
- Shell: pale blue-white sidebar and a translucent white top bar.
- Work surface: near-white panels with a fine white highlight and cool border.
- Raised control: solid or near-white with a short diffusion shadow.
- Primary action: education blue with a deeper physical base and restrained hover lift.
- Selected navigation: blue fill with white label; selected secondary controls use a pale blue tint.

## Tokens

- Page: `#EEF1F8`
- Shell: `#F7F9FE`
- Card: `#FFFFFF`
- Primary: `#2F6FED`
- Primary dark: `#2459C7`
- Cyan accent: `#42BCEB`
- Text: `#172033`
- Secondary text: `#4F5C73`
- Tertiary text: `#5F6B82`
- Border: `#DDE5F1`
- Control tint: `#EDF3FF`
- Radius: 12px controls and 20px cards/work panels; compact density reduces panels to 16px

Color is functional. Blue identifies action and location; green, amber, and red are reserved for status. Large decorative gradients are not used inside teacher work surfaces.

## Typography

- UI and data: the product sans stack already configured by EduAI Prism.
- Teaching-research titles may retain the existing restrained Chinese serif treatment.
- Page title: 24px/1.25, semibold.
- Section title: 14-16px, semibold.
- Body: 13px/1.65.
- Metadata: 11-12px with normal letter spacing.

## Components

- Page header: icon tile, title and supporting copy on the left; one compact action group on the right.
- Panel: one semantic region per panel; no panel nested inside another decorative panel.
- KPI strip: compact horizontal metrics with subdued icon tiles, not oversized dashboard cards.
- Inputs: 44px minimum height, white inset field, blue focus ring.
- Buttons: 160-200ms transform/shadow feedback; active state presses down by 1-2px.
- Empty state: centered icon, clear state, one direct next action when available.
- Tables: quiet header tint, 48px minimum data rows, hover and selected states that do not rely on color alone.

## Motion

- Hover/press: 160ms.
- Popover: 180ms.
- Modal: 220ms.
- Only transform and opacity are animated for layout feedback.
- `prefers-reduced-motion` disables nonessential movement.

## Responsive Rules

- Desktop: sidebar, top bar, and a centered work canvas up to the page-specific maximum width.
- Tablet: side details collapse before primary task content; toolbars wrap without horizontal overflow.
- Mobile: navigation becomes a drawer; page headers stack; tables use deliberate horizontal scroll only inside their own region.

## Asset Policy

Teacher operational pages use Lucide icons and CSS geometry. Generated illustration is reserved for a genuine explanatory or onboarding need; it is not required for this UI upgrade because decorative imagery would reduce information density and professional trust.
