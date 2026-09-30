#!/usr/bin/env python3
"""
Build data/landmark-map.js from a CSV file.

Required columns:
  district_no, avenue, street, image_id

image_id must be 5..35 for landmark artwork.
This script uses only Python's standard library.
"""
import csv, json, re, sys
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python tools/build_landmark_map.py tools/non_apartment_cells_template.csv")
    src = Path(sys.argv[1])
    project = Path(__file__).resolve().parents[1]
    out = project / "data" / "landmark-map.js"

    cells = {}
    with src.open("r", encoding="utf-8-sig", newline="") as f:
        for row_no, row in enumerate(csv.DictReader(f), start=2):
            try:
                d = int(row["district_no"])
                a = re.sub(r"[^A-Za-z]", "", row["avenue"]).upper()
                s = int(row["street"])
                image_id = int(row["image_id"])
            except Exception:
                continue
            if not (1 <= d <= 100 and a in "ABCDEFG" and 1 <= s <= 10 and 5 <= image_id <= 35):
                raise SystemExit(f"Invalid row {row_no}: {row}")
            cells[f"{d}|{a}|{s}"] = image_id

    payload = {"mode": "exact" if len(cells) == 2117 else "partial", "cells": cells}
    out.write_text("window.MURDER_CITY_LANDMARK_MAP = " + json.dumps(payload, separators=(",",":")) + ";\n", encoding="utf-8")
    print(f"Wrote {len(cells):,} landmark mappings to {out}")
    if len(cells) != 2117:
        print("Note: the QC audit has 2,117 non-apartment cells; exact mode requires all 2,117.")

if __name__ == "__main__":
    main()
