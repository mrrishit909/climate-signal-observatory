import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
PUBLIC = ROOT / "site" / "public" / "data"
CONTRACTS = ROOT / "data" / "contracts"
RAW = ROOT / "data" / "raw"


def load(name):
    return json.loads((PUBLIC / f"{name}.json").read_text())


@pytest.fixture(scope="session")
def art():
    if not (PUBLIC / "facts.json").exists():
        pytest.skip("run `uv run python -m pipelines.run_all` first")
    names = ["meta", "facts", "series_annual", "series_monthly", "trends", "regional", "extremes", "changepoints", "agreement", "co2", "ar6", "validation", "reconciliation"]
    return {n: load(n) for n in names}


@pytest.fixture(scope="session")
def sid(art):
    return {s["id"]: s for s in art["series_annual"]["series"]}


slow = pytest.mark.skipif(not (RAW / "gistemp" / "gistemp1200_GHCNv4_ERSSTv5.nc").exists(), reason="data/raw missing")
