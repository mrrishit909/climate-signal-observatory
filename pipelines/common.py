"""Shared paths and constants for the Climate Signal Observatory pipeline."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
MANIFESTS = ROOT / "data" / "manifests"
CONTRACTS = ROOT / "data" / "contracts"
REFERENCE = ROOT / "data" / "reference"
PUBLIC = ROOT / "site" / "public" / "data"

SCHEMA_VERSION = "v1"
BASELINES = ("1850-1900", "1951-1980", "1991-2020")
BASE_YEARS = {"1850-1900": (1850, 1900), "1951-1980": (1951, 1980), "1991-2020": (1991, 2020)}
MIN_MONTHS_CELL_YEAR = 9  # annual cell mean needs at least 9 of 12 monthly values
MIN_REF_SHARE = 0.8  # a baseline offset needs at least 80% of the reference years valid per cell


def write_json(path: Path, obj, compact: bool = True) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    s = json.dumps(obj, separators=(",", ":"), sort_keys=True, allow_nan=False) if compact else json.dumps(obj, indent=2, sort_keys=True, allow_nan=False)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(s + "\n")
    os.replace(tmp, path)
    return len(s) + 1
