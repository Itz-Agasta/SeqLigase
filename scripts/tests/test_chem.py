import pytest
from seqdata import chem

SMILES = ["CCO", "CC(=O)C", "CC(=O)O", "c1ccccc1", "Oc1ccccc1", "Nc1ccccc1", "Fc1ccccc1", "CCN", "N#Cc1ccccc1", "OC(=O)c1ccccc1"]


@pytest.mark.parametrize("smiles", SMILES)
def test_roundtrip(smiles):
    sel = chem.to_selfies(smiles)
    assert chem.canonical(chem.decode(sel).smiles) == chem.canonical(smiles)


@pytest.mark.parametrize("smiles", SMILES)
def test_token_atom_map(smiles):
    d = chem.decode(chem.to_selfies(smiles))
    # Every heavy atom comes from exactly one token, and that token maps back to it.
    assert sorted(d.atom_token) == sorted(set(d.atom_token))
    assert len(d.atom_token) == d.mol.GetNumAtoms()
    for atom, tok in enumerate(d.atom_token):
        assert d.tokens[tok].strip("[]").lstrip("=#").startswith(d.mol.GetAtomWithIdx(atom).GetSymbol())


def test_size_marker_tokens_are_not_atoms():
    # In [C][C][Branch1][C][C][=O] the token at index 3 is a branch size, not a carbon.
    d = chem.decode("[C][C][Branch1][C][C][=O]")
    assert d.atom_token == [0, 1, 4, 5]


def test_ring_tokens_map_to_the_closure_bond():
    d = chem.decode(chem.to_selfies("c1ccccc1"))
    ring = d.tokens.index("[Ring1]")
    bond = d.mol.GetBondWithIdx(d.token_bond[ring])
    assert {bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()} == {0, 5}


def test_properties():
    p = chem.properties(chem.mol("Oc1ccccc1"))
    assert p == {"mol_weight": 94.11, "logp": 1.39, "hbd": 1, "hba": 1}


def test_tanimoto_aniline_phenol():
    assert chem.tanimoto("Nc1ccccc1", "Oc1ccccc1") == 0.375
    assert chem.tanimoto("Oc1ccccc1", "Oc1ccccc1") == 1.0


def test_conformer_is_reproducible_and_3d():
    a = chem.conformer(chem.mol("Oc1ccccc1"))
    b = chem.conformer(chem.mol("Oc1ccccc1"))
    assert a.coords == b.coords
    assert a.is_3d and len(a.coords) == 13
    assert any(abs(c[2]) > 0 for c in a.coords)


def test_conformer_failure_falls_back_to_2d(monkeypatch):
    monkeypatch.setattr(chem.AllChem, "EmbedMolecule", lambda *a, **k: -1)
    c = chem.conformer(chem.mol("CCO"))
    assert not c.is_3d
    assert all(x[2] == 0 for x in c.coords)
