# uist2026.ahlab.org — project knowledge

Augmented Human Lab's showcase page for ACM UIST 2026 (Detroit, 2–5 Nov 2026). LIVE since
2026-11-02. Lab members share it with people they meet, so it must stay professional and
correct. Sibling of `../chi2026-ahlab` but rebuilt to the user's `ui-ux-style` skill rules.

## Stack and hosting

- Static, no build step: `index.html`, `styles.css`, `app.js` (ES module), `data/entries.json`.
- GitHub Pages from `main` / root of `augmented-human-lab/uist2026-ahlab` (public). Pushing to
  main deploys in about a minute. `CNAME` = `uist2026.ahlab.org`, HTTPS enforced.
- DNS at Linksky: `CNAME uist2026 → augmented-human-lab.github.io`. The GitHub cert stayed
  `null` until the custom domain was removed and re-added via
  `gh api -X PUT repos/augmented-human-lab/uist2026-ahlab/pages -f cname=uist2026.ahlab.org`.
- Local: `python3 -m http.server 4795 --bind 127.0.0.1` (4795 is outside the reserved bands in
  `~/.claude/CLAUDE.md`).
- **Cache busting:** `styles.css?v=N` and `app.js?v=N` in `index.html`. Bump N whenever either
  changes. A stale cached CSS once made the logo invisible for the user.

## Data

- Source: `https://files.sigchi.org/conference/program/UIST/2026`, the whole program as one JSON
  file. The SPA at programs.sigchi.org reads the same file. The original brief linked
  `programs.sigchi.org/uist/2026/search/content?searchKey=Suranga`.
- Refresh: `curl -sL <source> -o /tmp/uist2026.json && python3 scripts/build-data.py /tmp/uist2026.json data/entries.json`.
- Times in the program are Detroit wall-clock times stored as if they were UTC. The script
  attaches America/Detroit, which is EST (−05:00) after 1 Nov, and the page formats them in that
  zone.
- Hand-maintained tables at the top of `build-data.py`:
  - `AHL`: maps author names to ahlab.org slugs and sections.
  - `ids`: the 9 program ids.
  - `PAIR`: links each paper to its demo of the same work.
  - `PROJ` and `PROJNOTE`: map entries to ahlab.org project pages.
  - Photos and members are set per entry.
- **9 entries, not the 8 in the PI's message.** The extra pair is the FleetScape paper and demo,
  which come in through Peter Cleveland rather than Suranga, so they weren't counted. The user
  hasn't decided whether to drop the FleetScape demo.
  - FleetScape: paper 262857 and demo 277889
  - OpenGut: short paper 262865 and demo 277827
  - HeadRoom: short paper 262870 and demo 277848
  - CoGaze: poster 275891
  - FactNudger: demo 276185
  - Dinithi: Doctoral Symposium 275455. The program labels it "Doctoral Symposium", not "DC".
- At launch, DOIs, ACM DL links and videos were null. Re-run the refresh once they are
  published, check the diff, then push.
- These projects have no photos, so they show a name placeholder: HeadRoom, CoGaze, FleetScape
  and the DC entry. Ask the user for photos.

## Page structure (app.js)

- `projects()` groups entries by short title (the text before the colon). Paper and demo of the
  same work share one card: papers on top, demos and posters below, two rows of 3. Every
  session still appears in the schedule.
- `slots()` merges entries that share a start time and room. The Tuesday demo reception becomes
  one slot with name pills.
- Hero "Where to find us" shows Now and past states, refreshed every 60 s.
- Deep links: `#papers`, `#demos`, `#schedule`, `#lab`, plus `#p-<programId>`, which opens the
  detail dialog (abstract, links, .ics download).
- Share CTA: Web Share API, falling back to the clipboard.
- Theme toggle: localStorage key `ahl-theme`.
- Particle canvas uses domain glyphs.

## Style rules in force

- Follow the `ui-ux-style` skill: screen-fit groups with ↑/↓ paging, body as the scroller (no
  bounce), and a floating full-width app bar with one CTA ("Share this page").
- No dividers, no tallies ("6 projects"), no hover translateY, no emoji icons (Font Awesome
  6.5.1), and a one-line footer.
- AHL theme:
  - Accent #6100FF.
  - Hero gradient 221deg #00D7EE→#6100FF; dark mode uses #A36BFF.
  - Neue Haas Grotesk via Typekit `zws2qzx`.
  - Original horizontal AHL logo inlined as SVG (`viewBox="66 62 819 257"`, fill currentColor,
    explicit width/height). It is also in `assets/ahlab-logo.svg`.
- Share metadata is complete: OG/Twitter, 1200×630 `assets/og-image.jpg`, icons, manifest.

## Verify a change

```bash
cd tools && npm install            # puppeteer-core, uses the installed Google Chrome
node tools/check.mjs shots         # from repo root, with the local server running; SCHEME=light for light mode
node tools/og.mjs assets/og-image.jpg dark   # regenerate the share card after hero changes
```

- `check.mjs` prints, for each group, `h` (clientHeight) and `sh` (scrollHeight). Every group
  needs `sh ≤ h` at laptop size (1352×690) and MBP size (1440×900), with no horizontal overflow
  on a phone (390).
- Use puppeteer `setViewport`, not Chrome `--window-size`. Headless window size gives a viewport
  about 87px shorter and at least 500px wide, which produces misleading screenshots.
- After pushing, curl the live page and each asset for a 200 with the right content type.
  `BASE=https://uist2026.ahlab.org/ node tools/check.mjs` runs the same checks against
  production.
