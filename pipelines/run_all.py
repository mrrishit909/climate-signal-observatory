"""One entrypoint: data/raw -> data/interim -> site/public/data (idempotent).

    uv run python -m pipelines.run_all [--fetch]

--fetch   run ingestion first (re-downloads only files whose upstream Last-Modified changed)
Runtime per step is written to data/manifests/runtime.json.
"""
from __future__ import annotations

import argparse
import json
import time

from pipelines import publish
from pipelines.cleaning import clean
from pipelines.common import MANIFESTS


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    a = ap.parse_args()
    timings: dict[str, float] = {}

    def step(name, fn):
        t = time.time()
        fn()
        timings[name] = round(time.time() - t, 1)
        print(f"[{name}] {timings[name]}s", flush=True)

    if a.fetch:
        from pipelines.ingestion import fetch
        step("ingest", lambda: fetch.main([]))
    step("clean", clean.main)
    step("publish", publish.build_all)
    timings["total"] = round(sum(timings.values()), 1)
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    (MANIFESTS / "runtime.json").write_text(json.dumps(timings, indent=2) + "\n")
    print("total", timings["total"], "s")


if __name__ == "__main__":
    main()
