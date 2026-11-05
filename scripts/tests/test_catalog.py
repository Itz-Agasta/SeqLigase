import json
from pathlib import Path

import pytest
from seqdata import catalog, chem

ROOT = Path(__file__).resolve().parents[2]


def test_guide_molecules_are_all_candidates():
    names = {c["name"] for c in catalog.CANDIDATES}
    assert {"Ethanol", "Acetone", "Acetic acid", "Benzene", "Phenol", "Aniline", "Fluorobenzene", "Ethylamine"} <= names


def test_candidates_are_in_chemistry_scope():
    for c in catalog.CANDIDATES:
        m = chem.mol(c["smiles"])
        assert m.GetNumHeavyAtoms() <= 9, c["name"]
        assert {a.GetSymbol() for a in m.GetAtoms()} <= {"C", "N", "O", "F"}, c["name"]


def test_select_labels_by_membership():
    out = catalog.select({chem.canonical("CCO")})
    by = {c["name"]: c for c in out}
    assert by["Ethanol"]["source"] == "QM9"
    assert by["Phenol"]["source"] == "reference"


@pytest.mark.skipif(not (ROOT / "public/data/catalog.json").exists(), reason="data not built")
def test_built_catalog_size_and_membership():
    built = json.loads((ROOT / "public/data/catalog.json").read_text())
    assert 30 <= len(built) <= 50
    qm9 = {c["smiles"] for c in built if c["source"] == "QM9"}
    assert len(qm9) >= 30
