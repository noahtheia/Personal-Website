#!/usr/bin/env python3
"""
Apply a JSON patch to one or more content/farmland-financials/{TICKER}.json
period rows.

Patch shape (keyed by ticker → endDate → field-level updates):

    {
      "TSN": {
        "2024-09-28": { "totalEquityMM": 17460 },
        "2025-09-27": { "totalEquityMM": 19200 }
      },
      "ALCO": {
        "1995-08-31": { "expensesBySegmentMM": {...}, "cfoMM": 14.5 }
      }
    }

Modes:
  - preserve (default): only fill fields that are currently null/missing
  - overwrite: replace existing values (use for vintage refreshes)

Usage:
  python scripts/merge-financials-patch.py path/to/patch.json [--mode preserve|overwrite]
"""

import argparse
import json
import os
import sys
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIN_DIR = os.path.join(ROOT, "content", "farmland-financials")


def deep_merge_preserve(existing: Any, new: Any) -> Any:
    if not isinstance(existing, dict) or not isinstance(new, dict):
        return existing
    result = dict(new)
    for k, v in existing.items():
        if k in result:
            result[k] = deep_merge_preserve(v, result[k])
        else:
            result[k] = v
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("patch", help="Path to JSON patch file")
    parser.add_argument(
        "--mode",
        choices=["preserve", "overwrite"],
        default="preserve",
    )
    args = parser.parse_args()

    with open(args.patch, "r") as f:
        patch = json.load(f)

    rows_filled = 0
    fields_filled = 0
    files_touched = 0

    for ticker, by_date in patch.items():
        safe = "".join(c for c in ticker if c.isalnum() or c in "._-")
        path = os.path.join(FIN_DIR, f"{safe}.json")
        if not os.path.exists(path):
            print(f"  skip {ticker}: file not found", file=sys.stderr)
            continue
        with open(path, "r") as f:
            data = json.load(f)
        touched = False
        for period in data.get("periods", []):
            if period["endDate"] not in by_date:
                continue
            updates = by_date[period["endDate"]]
            for k, v in updates.items():
                if args.mode == "preserve":
                    if period.get(k) is None:
                        period[k] = v
                        fields_filled += 1
                        touched = True
                    elif isinstance(period.get(k), dict) and isinstance(v, dict):
                        merged = deep_merge_preserve(period[k], v)
                        if merged != period[k]:
                            period[k] = merged
                            fields_filled += 1
                            touched = True
                else:
                    period[k] = v
                    fields_filled += 1
                    touched = True
            if touched:
                rows_filled += 1
        if touched:
            files_touched += 1
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
                f.write("\n")

    print(
        f"merged {fields_filled} field operations across {rows_filled} period rows in {files_touched} files (mode={args.mode})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
