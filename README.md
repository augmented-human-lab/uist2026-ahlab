# uist2026.ahlab.org

Augmented Human Lab at ACM UIST 2026 (Detroit, 2–5 Nov 2026). A static page in the same
family as [chi2026.ahlab.org](https://chi2026.ahlab.org/). It has no build step.

- `index.html`, `styles.css`, `app.js`: the page. It renders project cards, the schedule
  and "Where to find us" from `data/entries.json`, with times in America/Detroit.
- `data/entries.json`: AHL entries pulled from the official UIST program.
- `scripts/build-data.py`: regenerates `entries.json` from the program JSON.
- `assets/icons/`, `manifest.webmanifest`, `assets/og-image.jpg`: icons and the share card.

## Run locally

```bash
python3 -m http.server 4795 --bind 127.0.0.1   # http://127.0.0.1:4795/
```

## Refresh the program data

The SIGCHI program publishes its whole program as one JSON file. DOIs, ACM DL links and
videos appear in it once the conference opens. To pick them up:

```bash
curl -sL https://files.sigchi.org/conference/program/UIST/2026 -o /tmp/uist2026.json
python3 scripts/build-data.py /tmp/uist2026.json data/entries.json
```

The program stores Detroit wall-clock times as if they were UTC, and the script converts
them back. AHL authors are matched by name in the `AHL` table at the top of the script.

## Deep links

- `#papers`, `#demos`, `#schedule`, `#lab`: sections.
- `#p-<programId>`: opens one entry's abstract and links, e.g. `#p-276185` (FactNudger).

## Deploy (GitHub Pages)

Same setup as `chi2026-ahlab`: push to `augmented-human-lab/uist2026-ahlab`, enable Pages on
`main` / root, and keep `CNAME` = `uist2026.ahlab.org`. DNS: `CNAME uist2026 →
augmented-human-lab.github.io`.
