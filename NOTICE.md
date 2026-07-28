# Third-party assets

## Hanafuda card faces

The 48 card face artworks in `public/cards/` are the work of
**Louie Mantia, Jr.**, obtained from Wikimedia Commons.

- **Author:** Louie Mantia, Jr. ([Louiemantia on Wikimedia Commons](https://commons.wikimedia.org/wiki/Special:ListFiles/Louiemantia))
- **Licence:** [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)
- **Source:** https://commons.wikimedia.org/wiki/Special:ListFiles/Louiemantia

The files are used **unmodified**. Only their filenames were changed, from
`Hanafuda_<Month>_<Category>[_n].svg` to this project's card identifiers
(`m<month>-<index>.svg`), so the renderer can address them directly.
`public/cards/CREDITS.json` records the original Commons filename for every
card, so the provenance of each file is recoverable.

### What CC BY-SA 4.0 requires of you

If you fork, redistribute or deploy this project:

- **Keep the attribution.** Credit Louie Mantia, Jr., name the CC BY-SA 4.0
  licence, and link to it. The app does this on the deck screen (`#/gallery`)
  and in the menu footer; this file and the README carry it too.
- **ShareAlike applies to the artwork.** If you *modify* these card faces —
  recolour, restyle, redraw, crop — you must release those adaptations under
  CC BY-SA 4.0 as well.
- ShareAlike does not extend to this repository's source code. The artwork and
  the code are separate works distributed together; the code is under the
  licence in `LICENSE`.

## Card back

`CardBack` in `src/art/CardFace.tsx` is this project's own work and is covered
by the repository's own licence, not CC BY-SA. It is not part of the Commons
set, which contains faces only.
