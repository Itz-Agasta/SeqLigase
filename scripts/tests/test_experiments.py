from seqdata import experiments


def test_roberta_params_match_published_chemberta():
    assert experiments._roberta_params(7924, layers=12) == 92_136_436


def test_t5_params_match_t5_small():
    assert experiments._t5_params(32128) == 60_506_624


def test_molt5_small_config_gives_about_77m():
    assert experiments._t5_params(32128, layers=8, ffn=1024, heads=6, gated=True, tied=False) == 76_961_152


def test_lstm_params_fit_the_checkpoint_size():
    assert experiments._rnn_params(35, False) == 3_269_603
