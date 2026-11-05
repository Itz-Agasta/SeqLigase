from seqdata import chem, runs


def facts(smiles, members=frozenset()):
    return chem.analysis(chem.mol(smiles), members)


def test_groups_on_known_molecules():
    assert "phenol" in facts("Oc1ccccc1")["groups"]
    assert "primary amine" in facts("Nc1ccccc1")["groups"]
    assert "carboxylic acid" in facts("CC(=O)O")["groups"]
    assert "ester" in facts("COC(C)=O")["groups"]
    assert "ether" not in facts("COC(C)=O")["groups"]
    assert "ether" in facts("COc1ccccc1")["groups"]
    assert "amide" in facts("CC(N)=O")["groups"]
    assert "primary amine" not in facts("CC(N)=O")["groups"]
    assert "nitrile" in facts("CC#N")["groups"]
    assert "aromatic nitrogen" in facts("c1ccncc1")["groups"]
    assert "ketone" in facts("CC(C)=O")["groups"]
    assert "aldehyde" in facts("CC=O")["groups"]
    assert "nitroso" in facts("CCCCN=O")["groups"]


def test_rings_and_aromaticity():
    benzene = facts("c1ccccc1")
    assert benzene["ringSizes"] == [6] and benzene["aromaticRings"] == 1
    assert facts("C1CCCCC1")["aromaticRings"] == 0
    assert facts("CCO")["ringSizes"] == []
    assert facts("OC1=CCCN=C1")["aromaticRings"] == 0


def test_flags_prompt_a_check():
    assert "three-membered ring (strained)" in facts("N1C=N1")["flags"]
    assert "N-N bond" in facts("N1C=N1")["flags"]
    assert "N-O bond" in facts("CCCCN=O")["flags"]
    assert facts("Oc1ccccc1")["flags"] == []


def test_membership_uses_canonical_form():
    assert facts("c1ccccc1O", {"Oc1ccccc1"})["inQm9"] is True
    assert facts("c1ccccc1O")["inQm9"] is False


def test_alternative_decodes_the_runner_up():
    tokens = chem.tokens_of("Oc1ccccc1")
    selfies = "".join(tokens)
    topk = {"4": [{"token": "[=C]", "p": 0.8}, {"token": "[=N]", "p": 0.1}], "5": [{"token": "[C]", "p": 0.5}, {"token": "[N]", "p": 0.4}]}
    record = {"selfies": selfies, "runs": {"T5:4:2": {"predicted_selfies": selfies, "mask_positions": [4, 5], "topk": topk}}}
    out = runs.note_facts(record)
    alt = out["runs"]["T5:4:2"]["alternative"]
    assert alt["position"] == 5 and alt["token"] == "[N]"
    assert alt["result"]["smiles"] == chem.decode("".join(tokens[:5] + ["[N]"] + tokens[6:])).smiles
    assert out["original"]["aromaticRings"] == 1
