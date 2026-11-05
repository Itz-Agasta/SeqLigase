import json

from seqdata import chem, predictor, runs

CORPUS = [chem.to_selfies(s) for s in ["CCO", "Oc1ccccc1", "Nc1ccccc1", "CC(=O)C", "c1ccncc1"]]
ENTRY = {"id": "aniline", "name": "Aniline", "smiles": "Nc1ccccc1", "source": "QM9"}


def rec():
    return runs.build_record(ENTRY, predictor.TokenStats.fit(CORPUS))


def test_all_runs_exist():
    r = rec()
    n = len(r["tokens"])
    keys = {f"{m}:{s}:{l}" for m in predictor.MODELS for l in (1, 2, 3) for s in range(n - l + 1)}
    assert set(r["runs"]) == keys


def test_response_shape_matches_contract():
    run = rec()["runs"]["BiLSTM:0:2"]
    for field in ["original_smiles", "original_selfies", "masked_selfies", "predicted_selfies", "predicted_smiles", "mask_positions", "topk", "valid", "token_accuracy", "exact_recovery", "tanimoto_similarity", "normalized_edit_distance", "properties", "candidate_id", "warnings"]:
        assert field in run
    assert run["mask_positions"] == [0, 1]
    assert run["masked_selfies"].startswith("[MASK][MASK]")


def test_aniline_lands_on_phenol():
    r = rec()
    for model in predictor.MODELS:
        run = r["runs"][f"{model}:0:1"]
        assert chem.canonical(run["predicted_smiles"]) == chem.canonical("Oc1ccccc1")
        assert run["tanimoto_similarity"] == 0.375
        assert run["valid"] is True
        assert run["exact_recovery"] is False
        assert run["properties"]["mol_weight"] == 94.11


def test_every_candidate_is_present_and_has_coordinates():
    r = rec()
    ids = {c["id"] for c in r["candidates"]}
    for run in r["runs"].values():
        if run["valid"]:
            assert run["candidate_id"] == "original" or run["candidate_id"] in ids
    for c in r["candidates"]:
        assert c["atoms"] and all(set(a) >= {"el", "x", "y", "z", "tokenIndex", "origIndex"} for a in c["atoms"])


def test_atoms_link_to_tokens():
    r = rec()
    heavy = [a for a in r["atoms"] if a["el"] != "H"]
    assert [a["tokenIndex"] for a in heavy] == r["atomTokens"]
    assert all(a["tokenIndex"] is None for a in r["atoms"] if a["el"] == "H")


def test_build_is_byte_identical():
    assert json.dumps(rec(), sort_keys=True) == json.dumps(rec(), sort_keys=True)


def test_exact_runs_recover_token_accuracy_one():
    for run in rec()["runs"].values():
        if run["predicted_selfies"] == run["original_selfies"]:
            assert run["token_accuracy"] == 1.0 and run["exact_recovery"] is True and run["tanimoto_similarity"] == 1.0
