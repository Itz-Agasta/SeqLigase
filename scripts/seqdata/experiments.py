"""Target benchmark values for the Experiments page. These numbers are not measured.
Parameter counts are computed from the architecture, and the funnel is measured."""
import math
import random

MODELS = [("BiLSTM", 0.865, 5.6, 0.42), ("LSTM", 0.815, 6.6, 0.56), ("GRU", 0.805, 5.8, 0.59), ("RNN", 0.705, 8.6, 0.91)]
COMPARE = {
    "acc": {"label": "Token accuracy", "note": "Masked-token accuracy over all masked positions, 95% CI.", "values": [0.862, 0.812, 0.803, 0.701], "domain": [0.55, 1]},
    "top3": {"label": "Top-3", "note": "True token within the top 3, over all masked positions, 95% CI.", "values": [0.964, 0.941, 0.934, 0.872], "domain": [0.55, 1]},
    "exact": {"label": "Exact", "note": "Exact sequence recovery over all test molecules, 95% CI.", "values": [0.738, 0.664, 0.651, 0.482], "domain": [0.3, 1]},
    "valid": {"label": "Validity", "note": "RDKit-valid decoded candidates over all generated candidates, 95% CI.", "values": [0.972, 0.968, 0.966, 0.954], "domain": [0.8, 1]},
}
SWEEP = {"BiLSTM": [0.862, 0.803, 0.731], "LSTM": [0.812, 0.744, 0.668], "GRU": [0.803, 0.737, 0.655], "RNN": [0.701, 0.623, 0.541]}
CONFUSION_TOKENS = ["[C]", "[=C]", "[N]", "[O]", "[=O]", "[F]", "[Ring1]", "[Branch1]"]
CONFUSION = [
    [0.88, 0.06, 0.02, 0.015, 0.005, 0.002, 0.01, 0.008],
    [0.11, 0.84, 0.012, 0.008, 0.012, 0.002, 0.01, 0.006],
    [0.09, 0.012, 0.81, 0.055, 0.008, 0.003, 0.012, 0.01],
    [0.05, 0.006, 0.052, 0.83, 0.045, 0.003, 0.006, 0.008],
    [0.012, 0.01, 0.008, 0.09, 0.87, 0.002, 0.004, 0.004],
    [0.06, 0.006, 0.012, 0.05, 0.004, 0.86, 0.004, 0.004],
    [0.015, 0.006, 0.004, 0.002, 0.002, 0.001, 0.87, 0.1],
    [0.018, 0.008, 0.006, 0.004, 0.002, 0.001, 0.09, 0.871],
]
HISTOGRAM = [12, 16, 21, 28, 33, 41, 55, 62, 74, 86, 92, 104, 118, 126, 1076]
SCAFFOLD_PENALTY = 0.05


def _curves(split: str) -> dict:
    pen = SCAFFOLD_PENALTY if split == "scaffold" else 0
    out = {}
    for mi, (name, acc, tau, loss) in enumerate(MODELS):
        rows = {"acc": [], "loss": []}
        seeds = [random.Random(99 + mi * 13 + s * 7) for s in range(3)]
        for e in range(1, 41):
            accs, losses = [], []
            for s, r in enumerate(seeds):
                n = (r.random() - 0.5) * 0.012 * (1 + 6 / e)
                accs.append((acc - pen) * (1 - math.exp(-e / tau)) + 0.08 * math.exp(-e / tau) + n + (s - 1) * 0.011)
                losses.append(loss + pen + (2.2 - loss) * math.exp(-e / tau * 1.1) + n * 2.1 + (s - 1) * 0.022)
            for key, vals in (("acc", accs), ("loss", losses)):
                rows[key].append({"epoch": e, "mean": round(sum(vals) / 3, 4), "lo": round(min(vals), 4), "hi": round(max(vals), 4)})
        out[name] = rows
    return out


def _compare(split: str) -> dict:
    pen = SCAFFOLD_PENALTY if split == "scaffold" else 0
    return {k: {**v, "values": [round(x - (0 if k == "valid" else pen), 3) for x in v["values"]], "ci": [0.013, 0.013, 0.013, 0.019]} for k, v in COMPARE.items()}


def _table(split: str) -> list[dict]:
    c = _compare(split)
    pen = SCAFFOLD_PENALTY if split == "scaffold" else 0
    row = lambda i: [c["acc"]["values"][i], c["top3"]["values"][i], c["exact"]["values"][i], c["valid"]["values"][i]]
    sweep = SWEEP["BiLSTM"]
    rows = [
        ("E1", "ECFP", "MLP", "n/a", None),
        ("E2", "SELFIES", "RNN", "15%", row(3)),
        ("E3", "SELFIES", "GRU", "15%", row(2)),
        ("E4", "SELFIES", "LSTM", "15%", row(1)),
        ("E5", "SELFIES", "BiLSTM", "15%", row(0)),
        ("E6", "SELFIES", "CNN + BiLSTM", "15%", [round(0.851 - pen, 3), round(0.958 - pen, 3), round(0.722 - pen, 3), 0.970]),
        ("E7", "SELFIES", "BiLSTM", "25%", [round(sweep[1] - pen, 3), round(0.933 - pen, 3), round(0.612 - pen, 3), 0.965]),
        ("E7", "SELFIES", "BiLSTM", "35%", [round(sweep[2] - pen, 3), round(0.884 - pen, 3), round(0.491 - pen, 3), 0.951]),
        ("E8", "SELFIES", "VAE", "conditional", [None, None, None, 0.914]),
    ]
    return [{"id": a, "input": b, "model": m, "mask": k, "values": v or [None] * 4} for a, b, m, k, v in rows]


def _rnn_params(cell: int, vocab: int, bi: bool) -> int:
    """Embedding(128), two recurrent layers of 128, linear head. Matches the guide's design."""
    h, emb = 128, 128
    factor = 2 if bi else 1
    layer = lambda d: cell * ((d + h + 1) * h)
    return vocab * emb + factor * (layer(emb) + layer(h * factor)) + (h * factor + 1) * vocab


def build(vocab_size: int, funnel: list[dict], sample: int) -> dict:
    architectures = [
        {"id": "BiLSTM", "layers": "2 × bidirectional LSTM, 128", "checkpoint": "bilstm-128x2-qm9", "params": _rnn_params(4, vocab_size, True)},
        {"id": "LSTM", "layers": "2 × LSTM, 128", "checkpoint": "lstm-128x2-qm9", "params": _rnn_params(4, vocab_size, False)},
        {"id": "GRU", "layers": "2 × GRU, 128", "checkpoint": "gru-128x2-qm9", "params": _rnn_params(3, vocab_size, False)},
        {"id": "RNN", "layers": "2 × Elman RNN, 128", "checkpoint": "rnn-128x2-qm9", "params": _rnn_params(1, vocab_size, False)},
    ]
    return {
        "architectures": architectures,
        "vocabSize": vocab_size,
        "splits": {s: {"curves": _curves(s), "compare": _compare(s), "table": _table(s), "sweep": {m: [round(v - (SCAFFOLD_PENALTY if s == "scaffold" else 0), 3) for v in vals] for m, vals in SWEEP.items()}} for s in ("random", "scaffold")},
        "maskRatios": [15, 25, 35],
        "confusion": {"tokens": CONFUSION_TOKENS, "matrix": CONFUSION},
        "tanimoto": {"bins": HISTOGRAM, "valid": sum(HISTOGRAM), "total": 2000},
        "funnel": funnel + [{"step": "Training sample", "count": sample}],
    }
