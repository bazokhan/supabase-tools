# Dashboard Animation Elegance Refresh

## Summary

Improve dashboard motion in `@sbtools/ui-web` so interactions feel polished and expressive, while remaining calm and readable.

Target outcome:
1. More intentional movement hierarchy (page transitions, section reveals, hover/focus responses).
2. Better timing/easing consistency across components.
3. Strong accessibility via `prefers-reduced-motion` fallback.

## Scope

1. In scope:
   - `packages/ui-web/src/styles/tokens.css`
   - Minimal class hooks in `packages/ui-web/src/dashboard/App.tsx` and page components only when needed for stagger/reveal behavior.
2. Out of scope:
   - Full UI redesign, color system overhaul, or component architecture rewrite.
   - Plugin data contract/API changes.

## Implementation Plan

1. Add a motion token layer in CSS.
   - Introduce variables for duration tiers (`--motion-fast`, `--motion-base`, `--motion-slow`) and easing curves (gentle entrance, standard interaction, expressive exit).
   - Replace ad-hoc timings/easing on key interaction selectors with tokenized values.

2. Refine route/page transition behavior.
   - Upgrade `.route-content-transition` from simple fade to a softer entrance (slight vertical lift + opacity + subtle blur reduction where appropriate).
   - Ensure transition remains short enough to avoid perceived lag during navigation.

3. Add tasteful staged reveal utilities for dense sections.
   - Add reusable classes for staggered child entrance (`.reveal-group` / `.reveal-item` with index-based delay variable).
   - Apply to high-signal areas such as overview stats/cards and major panel groups, not every element.

4. Improve micro-interactions on interactive surfaces.
   - Refine hover/focus transitions for nav links, panels, action pills, and table rows using subtle elevation/translate and shadow shifts.
   - Keep movement amplitude low to avoid flashy behavior.

5. Unify overlays and transient UI motion.
   - Normalize tooltip, search popover, modal, and mobile sidebar animation timing/easing so they feel like one system.
   - Keep existing behavior semantics while improving visual smoothness.

6. Add reduced-motion safeguards.
   - Implement `@media (prefers-reduced-motion: reduce)` to disable or simplify non-essential animations/transforms.
   - Preserve critical state-change cues via instant or near-instant opacity/background changes.

## Validation Plan

1. Run build for UI package:
   - `npm run build -w packages/ui-web`
2. Manual verification in dashboard:
   - Route switches feel smooth and not delayed.
   - Overview/cards reveal with mild stagger (no jitter).
   - Hover/focus states remain clear and restrained.
   - Modal/sidebar/tooltip motion feels consistent.
   - Reduced-motion mode removes decorative motion.
3. Regression check:
   - No layout shifts introduced by transforms/filters.
   - No interaction blockers from animation wrappers.

## Risks and Mitigations

1. Risk: Over-animating creates visual noise.
   - Mitigation: Limit stagger usage to top-level groups and cap delays/distance.
2. Risk: Reduced-motion regressions.
   - Mitigation: Add explicit reduce-motion overrides for all animation utility classes and key interactive selectors.
3. Risk: Performance dips on lower-end hardware.
   - Mitigation: Favor `opacity`/`transform`, avoid heavy continuous effects, and keep animation durations short.
