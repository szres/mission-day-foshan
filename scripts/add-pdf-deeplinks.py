#!/usr/bin/env python3
"""Add Ingress mission deeplinks to each mission page in the FSMD booklet.

The booklet is fully rasterized (no text layer), so we can't search for the
title text. Instead we rely on the verified layout convention:

    page (1-indexed) = mission_order + 4

Pages 5..28 = missions 1..24; page 1 is the cover, page 2 is the supporter
list, page 3 is the overview map, page 4 is general notes, and page 29 is
the back cover.

The link rectangle covers the mission-title banner — the strip just below
the map view that contains "FOSHAN MD2026 巨献" + the big mission name +
the orange mission-number bar. Anywhere a reader naturally taps to ask
"open this mission in Ingress" should hit the link.
"""

from __future__ import annotations
import json
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "public" / "mission-overview.pdf"
INGRESS_LINKS = ROOT / "public" / "ingress-missions.json"


def load_links() -> dict[int, str]:
    with INGRESS_LINKS.open(encoding="utf-8") as fh:
        raw = json.load(fh)
    return {int(k): v for k, v in raw.items() if k.isdigit()}


def title_rect(page: fitz.Page) -> fitz.Rect:
    """Banner strip just below the map view, where the title sits."""
    r = page.rect
    return fitz.Rect(
        r.x0,
        r.y0 + r.height * 0.50,   # start below the map
        r.x1,
        r.y0 + r.height * 0.72,   # stop just above the keyword strip
    )


def main() -> int:
    links = load_links()
    doc = fitz.open(PDF)

    placed = []
    for order, url in sorted(links.items()):
        page_index = order + 4 - 1   # 1-indexed page (order+4) → 0-indexed
        if page_index < 0 or page_index >= doc.page_count:
            print(f"  #{order:>2} skipped — page {page_index+1} out of range")
            continue
        page = doc[page_index]
        rect = title_rect(page)

        # Drop any existing link annotations in that rect so re-runs are
        # idempotent (handy if we tweak the rectangle later).
        for link in list(page.get_links()):
            if fitz.Rect(link.get("from", (0, 0, 0, 0))).intersects(rect):
                page.delete_link(link)

        page.insert_link({
            "kind": fitz.LINK_URI,
            "from": rect,
            "uri": url,
        })
        placed.append((order, page_index + 1))

    # Try incremental save first; fall back to full rewrite if needed.
    try:
        doc.save(PDF, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    except Exception:
        tmp = str(PDF) + ".tmp"
        doc.save(tmp)
        doc.close()
        Path(tmp).replace(PDF)
    else:
        doc.close()

    print(f"linked {len(placed)} missions:")
    for order, page in placed:
        print(f"  #{order:>2}  page {page:>2}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
