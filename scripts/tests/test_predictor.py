import statistics

from seqdata import chem, predictor

CORPUS = [chem.to_selfies(s) for s in ["CCO", "CC(=O)C", "Oc1ccccc1", "Nc1ccccc1", "Fc1ccccc1", "CCN", "CC(=O)O", "c1ccncc1", "CC#N", "OCCO"]]


def stats():
    return predictor.TokenStats.fit(CORPUS)


def test_phenol_pin():
    p = predictor.predict(stats(), "Phenol", chem.tokens_of("Oc1ccccc1"), "BiLSTM", 4, 2)
    assert [p[4][0]["token"], p[5][0]["token"]] == ["[=C]", "[C]"]
    assert [p[4][0]["p"], p[5][0]["p"]] == [0.881, 0.843]


def test_aniline_pin_for_every_model():
    tokens = chem.tokens_of("Nc1ccccc1")
    for model in predictor.MODELS:
        for length in (1, 2, 3):
            p = predictor.predict(stats(), "Aniline", tokens, model, 0, length)
            assert p[0][0]["token"] == "[O]"
            assert any(c["token"] == "[N]" for c in p[0])


def test_probabilities_sum_below_one_and_sort_descending():
    tokens = chem.tokens_of("Oc1ccccc1")
    p = predictor.predict(stats(), "Phenol", tokens, "ChemBERTa", 2, 3)
    for cands in p.values():
        ps = [c["p"] for c in cands]
        assert ps == sorted(ps, reverse=True)
        assert sum(ps) <= 1.0025  # five values, each rounded to 3 places
        assert len(cands) == 5


def test_deterministic():
    tokens = chem.tokens_of("Oc1ccccc1")
    assert predictor.predict(stats(), "Phenol", tokens, "T5", 1, 2) == predictor.predict(stats(), "Phenol", tokens, "T5", 1, 2)


def test_error_rates_order_models():
    tokens = [(s, chem.tokens_of(s)) for s in ["Oc1ccccc1", "CC(=O)O", "Fc1ccccc1", "c1ccncc1", "CC(=O)C", "OC(=O)c1ccccc1", "COc1ccccc1", "O=Cc1ccccc1"]]
    st = stats()
    acc = {}
    for model in predictor.MODELS:
        hits = []
        for name, t in tokens:
            for start in range(len(t)):
                for length in (1, 2, 3):
                    if start + length > len(t):
                        continue
                    p = predictor.predict(st, name, t, model, start, length)
                    hits += [p[i][0]["token"] == t[i] for i in p]
        acc[model] = statistics.mean(hits)
    assert acc["BiLSTM"] > acc["LSTM"] >= acc["ChemBERTa"] - 0.01 > acc["T5"]
    assert 0.72 < acc["BiLSTM"] < 0.95
    assert 0.5 < acc["T5"] < 0.8
