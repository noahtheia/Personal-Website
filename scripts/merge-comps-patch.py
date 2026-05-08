#!/usr/bin/env python3
"""
Apply a JSON patch to content/farmland-comps.json.

Two modes:
  1. preserve: existing values win on conflict (deep merge). Default.
                Use when filling gaps from agent recall.
  2. overwrite: patch values win. Use for vintage refreshes (FY24 → FY25).

Patch file is a JSON object keyed by ticker, with partial-row patches:

    {
      "TICKER": { "field1": value, "nested": { "subfield": value } },
      ...
    }

Usage:
  python scripts/merge-comps-patch.py path/to/patch.json [--mode preserve|overwrite]

Side effects:
  - Strips zero/null scalars in "preserve" mode (treats them as
    "not applicable" placeholders rather than real data).
  - Writes back with 2-space indent + trailing newline so diffs stay
    git-friendly.
"""

import argparse
import json
import os
import sys
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPS_FILE = os.path.join(ROOT, "content", "farmland-comps.json")


def strip_placeholders(obj: Any) -> Any:
    """Drop 0/0.0/null scalars and empty dicts. Recursive."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            cleaned = strip_placeholders(v)
            if cleaned is None:
                continue
            if isinstance(cleaned, dict) and not cleaned:
                continue
            out[k] = cleaned
        return out
    if isinstance(obj, list):
        return [strip_placeholders(x) for x in obj if x is not None]
    if obj == 0 or obj == 0.0 or obj == "":
        return None
    return obj


def deep_merge_preserve(existing: Any, new: Any) -> Any:
    """Merge `new` into `existing`. Existing values win on conflict."""
    if not isinstance(existing, dict) or not isinstance(new, dict):
        return existing
    result = dict(new)
    for k, v in existing.items():
        if k in result:
            result[k] = deep_merge_preserve(v, result[k])
        else:
            result[k] = v
    return result


def deep_merge_overwrite(existing: Any, new: Any) -> Any:
    """Merge `new` into `existing`. New values win on conflict."""
    if not isinstance(existing, dict) or not isinstance(new, dict):
        return new
    result = dict(existing)
    for k, v in new.items():
        if k in result:
            result[k] = deep_merge_overwrite(result[k], v)
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
        help="Merge mode (default: preserve existing values)",
    )
    args = parser.parse_args()

    with open(args.patch, "r") as f:
        patch = json.load(f)

    with open(COMPS_FILE, "r") as f:
        rows = json.load(f)

    touched = 0
    for row in rows:
        t = row.get("ticker")
        if t not in patch:
            continue
        values = patch[t]
        if args.mode == "preserve":
            values = strip_placeholders(values) or {}
        for k, v in values.items():
            if args.mode == "preserve" and k in row:
                row[k] = deep_merge_preserve(row[k], v)
            elif args.mode == "overwrite" and isinstance(row.get(k), dict) and isinstance(v, dict):
                row[k] = deep_merge_overwrite(row[k], v)
            else:
                row[k] = v
        touched += 1

    with open(COMPS_FILE, "w") as f:
        json.dump(rows, f, indent=2)
        f.write("\n")

    print(f"Patches applied to {touched} tickers (mode={args.mode})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
