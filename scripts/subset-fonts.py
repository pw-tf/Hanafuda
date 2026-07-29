#!/usr/bin/env python3
"""
Build the self-hosted webfonts in public/fonts/.

The UI is mostly English with a small, fixed set of Japanese: the yaku names,
the card and suit names, and the こいこい on the menu. A full Japanese mincho is
~1.4 MB per weight, which is absurd for the 65 glyphs this game actually shows,
so each weight is subset down to exactly the characters found in the source.

Run this after adding or changing any Japanese string:

    pip install fonttools brotli
    python3 scripts/subset-fonts.py

It reports the glyph inventory it found and fails loudly if a character has no
glyph in the font, rather than shipping a file that renders tofu. The output is
committed, so a normal build and the CI never need Python or the npm font
packages.
"""

import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"

# Where Japanese text can appear. Kept explicit: a glob over src/ would silently
# start passing when someone puts Japanese in a new file, and the point of this
# list is that adding one is a deliberate step that ends in re-running the
# script.
JA_SOURCES = [
    "src/ui/screens/Menu.tsx",
    "src/engine/cards.ts",
    "src/engine/rules.ts",
]

# Kana, CJK ideographs, and fullwidth forms.
JA_RANGES = [(0x3000, 0x30FF), (0x4E00, 0x9FFF), (0xFF00, 0xFFEF)]

# Everything the Latin cut has to cover: printable ASCII plus the typographic
# characters the UI uses (·, ×, ellipsis, curly quotes, the ‹ back chevron).
LATIN = set(chr(c) for c in range(0x20, 0x7F)) | set("·×…‹›—–’‘“”°")

FACES = [
    # (family, npm package, weight, output basename)
    ("Shippori Mincho", "shippori-mincho", 400, "shippori-mincho-400"),
    ("Shippori Mincho", "shippori-mincho", 600, "shippori-mincho-600"),
    ("Shippori Mincho", "shippori-mincho", 700, "shippori-mincho-700"),
]


def japanese_inventory() -> set[str]:
    found: set[str] = set()
    for rel in JA_SOURCES:
        path = ROOT / rel
        if not path.exists():
            sys.exit(f"missing source file: {rel}")
        for ch in path.read_text(encoding="utf-8"):
            o = ord(ch)
            if any(lo <= o <= hi for lo, hi in JA_RANGES):
                found.add(ch)
    return found


def source_file(package: str, weight: int, cut: str) -> pathlib.Path:
    path = ROOT / "node_modules" / "@fontsource" / package / "files" / f"{package}-{cut}-{weight}-normal.woff2"
    if not path.exists():
        sys.exit(f"missing font source: {path}\nrun: npm i -D @fontsource/{package}")
    return path


def build(family: str, package: str, weight: int, basename: str, text: set[str]) -> None:
    """Merge the Latin and Japanese cuts of one weight into a single subset."""
    merged = TTFont(source_file(package, weight, "japanese"))
    latin = TTFont(source_file(package, weight, "latin"))

    # The two fontsource cuts are subsets of one original face, so a character
    # present in either is safe to ask for; check against the union rather than
    # one file, or every Latin letter looks "missing" from the Japanese cut.
    covered = set(merged.getBestCmap()) | set(latin.getBestCmap())
    missing = sorted(c for c in text if ord(c) not in covered)
    if missing:
        sys.exit(f"{basename}: no glyph for {''.join(missing)!r}")

    for font, cut in ((merged, "japanese"), (latin, "latin")):
        wanted = {c for c in text if ord(c) in font.getBestCmap()}
        options = subset.Options()
        options.layout_features = ["*"]
        options.drop_tables += ["DSIG"]
        options.notdef_outline = True
        options.recalc_bounds = True
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text="".join(sorted(wanted)))
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(OUT / f"{basename}-{cut}.woff2")

    latin.close()
    merged.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    japanese = japanese_inventory()
    print(f"japanese glyphs: {len(japanese)}  {''.join(sorted(japanese))}")

    for family, package, weight, basename in FACES:
        build(family, package, weight, basename, LATIN | japanese)
        for cut in ("latin", "japanese"):
            path = OUT / f"{basename}-{cut}.woff2"
            print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
