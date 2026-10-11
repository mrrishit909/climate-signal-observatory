import json

import pytest
from jsonschema import Draft202012Validator

from pipelines.contracts import FACT_KEYS, SCHEMAS
from tests.conftest import CONTRACTS, PUBLIC, ROOT


def test_schema_files_match_generator():
    for n, sc in SCHEMAS.items():
        on_disk = json.loads((CONTRACTS / f"{n}.schema.json").read_text())
        assert on_disk == json.loads(json.dumps(sc, sort_keys=True)), f"{n}: regenerate with python -m pipelines.contracts"
        Draft202012Validator.check_schema(on_disk)


@pytest.mark.parametrize("f", sorted(p.name for p in PUBLIC.glob("*.json")) or ["none"])
def test_artifact_validates(f):
    if f == "none":
        pytest.skip("no artifacts")
    stem = f[:-5]
    schema = ("grid_trends_meta" if stem.startswith("grid_trends_") else "grid_meta") if stem.endswith(".meta") else stem
    data = json.loads((PUBLIC / f).read_text())
    errs = list(Draft202012Validator(json.loads((CONTRACTS / f"{schema}.schema.json").read_text())).iter_errors(data))
    assert not errs, f"{f}: {errs[0].message} at {list(errs[0].path)[:5]}"


def test_every_schema_has_an_artifact():
    arts = {p.stem for p in PUBLIC.glob("*.json")}
    for n in SCHEMAS:
        if n not in ("grid_meta", "grid_trends_meta"):
            assert n in arts, n
    assert {"grid_gistemp_2deg.meta", "grid_hadcrut5_5deg.meta", "grid_gistemp_2deg_intro.meta", "grid_trends_gistemp_2deg.meta", "grid_trends_hadcrut5_5deg.meta"} <= arts


def test_facts_complete_and_tagged(art):
    facts = art["facts"]["facts"]
    assert set(facts) == set(FACT_KEYS)
    for k, f in facts.items():
        assert f["value"] is not None, k


def test_no_forbidden_dashes_anywhere():
    bad = []
    for p in list(ROOT.glob("docs/*.md")) + list(ROOT.glob("data/**/*.json")) + list(ROOT.glob("data/reference/*.csv")) + list(PUBLIC.glob("*.json")) + list(ROOT.glob("pipelines/**/*.py")) + list(ROOT.glob("analytics/*.py")) + list(ROOT.glob("tests/*.py")):
        t = p.read_text(encoding="utf8")
        if chr(0x2014) in t or chr(0x2015) in t:
            bad.append(str(p))
    assert not bad, bad


def test_every_tag_field_is_a_known_tag(art):
    for n, a in art.items():
        for k, v in a["tags"].items():
            assert all(t in {"OBSERVED", "DERIVED", "PREDICTED", "SIMULATED", "SYNTHETIC"} for t in v.split("/")), (n, k)


def test_every_field_has_a_tag():
    for f in PUBLIC.glob("*.json"):
        d = json.loads(f.read_text())
        missing = [k for k in d if k not in ("schema_version", "tags") and k not in d["tags"]]
        assert not missing, (f.name, missing)
