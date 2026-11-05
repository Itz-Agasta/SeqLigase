from seqdata import experiments


def test_roberta_params_match_published_chemberta():
    assert experiments._roberta_params(7924, layers=12) == 92_136_436


def test_t5_params_match_t5_small():
    assert experiments._t5_params(32128) == 60_506_624
