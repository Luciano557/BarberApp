

## Refined Plan: Full UI Refactor — Design System V2.1 (Transition Hardening)

All previous V2.1 rules remain unchanged. This adds one strict rule to the Animation/Transition section.

---

### TRANSITION RESTRICTION (replaces `transition-all` usage)

**Rule**: `transition-all` is FORBIDDEN across the entire codebase.

Every component must declare only the specific properties it animates:

| Component | Allowed transition class | Reason |
|---|---|---|
| Button | `transition-colors duration-150` | Only bg/text color changes on hover |
| Input | `transition-colors duration-150` | Only border/ring color on focus |
| Card (interactive) | `transition-colors duration-150` | Only border-color on hover |
| Card (pressable) | `transition-transform duration-200` | Only scale on active |
| Tabs trigger | `transition-colors duration-150` | Only bg/text swap |
| Badge | No transition | Static element |
| Dialog/Sheet overlay | `transition-opacity duration-200` | Only fade |
| Table row | `transition-colors duration-150` | Only bg on hover |
| Sidebar nav item | `transition-colors duration-150` | Only bg/text on hover/active |

**Allowed transition utilities** (only these four):
- `transition-colors` — for background-color, border-color, color, fill, stroke
- `transition-opacity` — for opacity only
- `transition-transform` — for transform (scale, translate) only
- `transition-shadow` — for box-shadow only

**If a component needs two properties** (e.g., color + transform), combine them explicitly: `transition-[color,transform] duration-150` — still no `transition-all`.

**Implementation impact on existing plan files**:

- `button.tsx`: Change `transition-all duration-150` → `transition-colors duration-150`
- `input.tsx`: Use `transition-colors duration-150`
- `card.tsx`: Interactive cards use `transition-colors duration-150`
- `tabs.tsx`: Use `transition-colors duration-150`
- `dialog.tsx` / `sheet.tsx`: Overlay uses `transition-opacity duration-200`
- All page-level components: Replace any `transition-all` with the specific property class

**Enforcement**: After refactor, grep for `transition-all` across all `.tsx` and `.css` files. Any match is a bug.

### Everything else from V2.1 remains intact

- Override rules, composition rules, state consistency, typography, spacing, theme architecture, enforcement checklist — all unchanged.

