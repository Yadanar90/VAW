---
target: header/banner (.app-header, .app-header-panel)
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 1
timestamp: 2026-08-14T16-46-51Z
slug: app-jsx-header-banner-app-header-app-header-panel
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Live result counts and dropdown option counts are solid; header itself carries no status. |
| 2 | Match System / Real World | 2/4 | Body copy is plain and appropriate; banner imagery has no relationship to the platform's subject matter. |
| 3 | User Control and Freedom | 3/4 | "Back to overview" exists; no header-level issue. |
| 4 | Consistency and Standards | 2/4 | Ornate/decorative banner vs. flat minimal dashboard below reads as two different products. |
| 5 | Error Prevention | 3/4 | Disabled CTA with a clear empty-state message prevents dead clicks. |
| 6 | Recognition Rather Than Recall | 3/4 | Filter dropdowns show live availability counts. |
| 7 | Flexibility and Efficiency | n/a | No meaningful power-user shortcut surface for a filter/browse tool this size. |
| 8 | Aesthetic and Minimalist Design | 1/4 | Two border strips + tiled lattice + shadowed plaque + 4 rivets + kicker is heavy ornament against an otherwise minimal dashboard. |
| 9 | Error Recovery | 3/4 | Zero-results state is clear and humane. |
| 10 | Help and Documentation | n/a | Tool is simple enough that in-context help isn't a meaningful gap. |
| **Total** | | **20/32** | **Acceptable (63%)** |

## Design Specificity Verdict

**LLM assessment:** Not specific to this product. Swap the H1 text to "Regional Textile Museum" or "Artisan Marketplace" and the banner reads as correctly designed for that instead — nothing in the crimson beadwork lattice, the bead-motif border strips, or the rounded rivet-cornered plaque signals research, evidence, or violence prevention. It was designed to look striking, not to communicate what this platform is. The body below it (filter bar, bar charts, country map) is data-dense and utilitarian with zero visual kinship to the banner.

**Deterministic scan:** `detect.mjs --json src/App.jsx src/App.css` — exit 0, **0 findings**. No false positives to report since nothing was flagged; the detector's rule set doesn't cover cultural/tonal fit, only mechanical UI anti-patterns.

**Visual overlays:** No browser-injection overlay was run (this critique used direct screenshot + computed-style inspection instead, per Assessment B); no user-visible overlay exists to point you to. All contrast figures below are exact computed values, not estimates.

## Overall Impression

Technically, this banner is clean: zero detector findings, zero console errors, no focusable elements in a decorative region, and text contrast that clears WCAG AA with real margin (8.96:1 for the title). Where it actually falls short is fit — both to the rest of this product (a plain, functional data dashboard) and, more seriously, to its subject matter. The single biggest issue isn't a UI bug, it's that the banner's ornamental motif was drawn from a real, named ethnic group's textile craft (Karen beadwork) and is being used as anonymous decorative chrome on an unrelated GBV platform, with no attribution or connection back to that population anywhere in the app.

## What's Working

1. **Disabled-CTA empty state** (`.view-results-cta:disabled`, "No studies match these filters yet") — prevents a dead click and explains why, instead of a silently greyed-out button.
2. **Live filter-option counts** — dropdowns show which combinations still return results before commit, cutting dead-end frustration (heuristic 6).
3. **Kicker-above-title IA pattern** is sound in principle (category label before specific title); the execution just undercuts it (see P3).
4. **Solid technical accessibility floor**: title contrast 8.96:1 (AA + AAA pass), kicker 5.39:1 (AA pass), zero console errors, header correctly has no focusable elements.

## Priority Issues

**[P0] Unattributed ethnic textile pattern on a sensitive-topic platform**
- **What:** The beadwork pattern (main lattice + both border strips) is modeled directly on a real Karen ethnic textile photo, used as purely decorative chrome behind a GBV platform's title, with no attribution or explanatory link anywhere in the codebase.
- **Why it matters:** This is a reputational/ethics risk, not a visual one. Karen communities have their own documented history with gender-based violence in conflict contexts; borrowing their craft motif ornamentally for a different, unconnected GBV platform — uncredited — is exactly the kind of choice that draws public criticism and undermines trust with the researchers/practitioners this platform serves.
- **Fix:** Either replace the pattern with an original abstract mark drawn from the platform's own visual language (data/evidence motifs, not a specific culture's craft), or, if the reference is intentional, add real attribution and get input from someone with standing to advise on appropriateness. Don't ship it as anonymous decoration.
- **Suggested command:** `/impeccable adapt`

**[P1] Banner's visual identity doesn't match the rest of the product**
- **What:** Ornate, pattern-heavy, shadow-lifted plaque sits directly above a flat, minimal, functional dashboard.
- **Why it matters:** The jump reads as two different products bolted together, undermining trust that this is one coherent, rigorous research tool.
- **Fix:** Either simplify the banner toward the dashboard's minimal language, or thread a toned-down version of the motif into the body so it reads as one system.
- **Suggested command:** `/impeccable quieter`

**[P2] Mobile banner burns vertical space before the primary task**
- **What:** On mobile the H1 wraps to three lines; pattern border strips + panel padding push the filter bar further down the page.
- **Why it matters:** Mobile users spend their most limited screen space on non-functional chrome before reaching the actual task.
- **Fix:** Shrink border-strip height and panel padding specifically at the mobile breakpoint, beyond the current font-size-only adjustment.
- **Suggested command:** `/impeccable layout`

**[P3] Kicker legibility margin is thin**
- **What:** `.header-kicker` is 11px/10px, tracked uppercase, `#e7b9c2` on `#8A1636` — computed contrast 5.39:1, AA pass but AAA fail, with little margin if either color shifts later.
- **Why it matters:** This line carries the platform's mission statement in miniature ("Evidence for prevention") — it's the smallest, lowest-contrast text on the page despite being one of the more important cues to a first-time visitor.
- **Fix:** Bump to 12-13px minimum; re-verify contrast after any future color token changes.
- **Suggested command:** `/impeccable typeset`

## Persona Red Flags

**Jordan (First-Timer):** Lands on the page and the banner gives no immediate signal this is a research/evidence tool — no logo, no institutional marker, just an ornate craft-pattern plaque. The one textual cue to purpose ("Evidence for prevention") is the smallest, lowest-contrast text on the page (11px vs. 32px H1) — the thing that most needs to orient a new visitor is the least emphasized element.

**Casey (Mobile):** Banner plus both pattern border strips consume a disproportionate share of the mobile viewport, with a 3-line-wrapped title before the filter bar even appears. The lattice's 78px tile size is fixed, not scaled down for smaller screens, so it can look busier than intended at mobile density.

## Minor Observations

- `.app-header p { ... }` in App.css targets a `<p>` that no longer exists in the header markup — dead CSS from an earlier version.
- The four corner rivets are implemented two different ways (top two via `::before`/`::after`, bottom two via real `.panel-rivet` spans) — functionally identical, minor code-consistency debt.
- Top border strip (near-black) and bottom border strip (cream) are different weights/colors, so the plaque doesn't read as symmetrically framed.
- Three overlapping pattern layers tiled at 78px could produce visual buzz/moiré at non-100% browser zoom — worth a quick check at 90%/125%/150%.

## Questions to Consider

1. If you had to justify the crimson beadwork pattern to a Karen community member or a GBV survivor-advocate reading this site, what would it be doing for them — beyond "it looked good"?
2. Would this exact banner work equally well with the title swapped to "Regional Textile Museum"? If yes, what does that say about how authored-for-this-product it actually is?
3. Is a nameplate/plaque the first thing you want a visitor's eye to land on for a rigorous evidence platform — or does it read closer to a decorative certificate than a data tool?
