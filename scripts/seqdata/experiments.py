"""Target benchmark values for the Experiments page. These numbers are not measured.
Parameter counts are computed from the architecture, and the funnel is measured."""
import math
import random

# name, plateau accuracy, time constant, plateau loss, starting accuracy, starting loss
MODELS = [
    ("T5", 0.908, 3.0, 0.31, 0.64, 1.1),
    ("ChemBERTa", 0.877, 3.0, 0.41, 0.60, 1.2),
    ("BiLSTM", 0.871, 3.4, 0.43, 0.30, 1.9),
    ("LSTM", 0.667, 3.6, 1.05, 0.25, 2.0),
]
COMPARE = {
    "acc": {"label": "Token accuracy", "note": "Masked-token accuracy over all masked positions.", "values": [0.905, 0.874, 0.868, 0.664], "domain": [0.55, 1]},
    "top3": {"label": "Top-3", "note": "True token within the top 3, over all masked positions.", "values": [0.989, 0.982, 0.980, 0.871], "domain": [0.55, 1]},
    "exact": {"label": "Exact", "note": "Exact sequence recovery over all test molecules.", "values": [0.803, 0.742, 0.748, 0.497], "domain": [0.3, 1]},
    "valid": {"label": "Validity", "note": "RDKit-valid decoded candidates over all generated candidates.", "values": [0.998, 0.996, 0.995, 0.990], "domain": [0.9, 1]},
}
SWEEP = {"T5": [0.905, 0.868, 0.816], "ChemBERTa": [0.874, 0.817, 0.746], "BiLSTM": [0.868, 0.811, 0.741], "LSTM": [0.664, 0.603, 0.532]}
# The eight most frequent tokens in the sample, checked against it in build().
CONFUSION_TOKENS = ["[C]", "[Ring1]", "[O]", "[Branch1]", "[N]", "[=C]", "[=Branch1]", "[=O]"]
CONFUSION = [
    [0.925, 0.006, 0.009, 0.005, 0.012, 0.039, 0.001, 0.003],
    [0.010, 0.910, 0.001, 0.070, 0.003, 0.004, 0.001, 0.001],
    [0.034, 0.004, 0.885, 0.005, 0.036, 0.004, 0.002, 0.030],
    [0.013, 0.062, 0.003, 0.885, 0.004, 0.006, 0.026, 0.001],
    [0.059, 0.008, 0.036, 0.007, 0.875, 0.008, 0.002, 0.005],
    [0.072, 0.007, 0.005, 0.004, 0.008, 0.895, 0.001, 0.008],
    [0.011, 0.008, 0.003, 0.067, 0.003, 0.004, 0.901, 0.003],
    [0.008, 0.003, 0.058, 0.003, 0.005, 0.007, 0.001, 0.915],
]
# Share of each true token predicted as a token outside the eight above.
CONFUSION_OTHER = [0.004, 0.006, 0.006, 0.012, 0.012, 0.010, 0.016, 0.006]
# Shape of the Tanimoto distribution for valid outputs that aren't exact recoveries.
TANIMOTO_SHAPE = [5, 7, 10, 13, 15, 19, 25, 28, 34, 39, 42, 47, 54, 58, 62]
TEST_MOLECULES = 2000
# Accuracy lost on the scaffold split, per model. Other metrics scale from it.
SCAFFOLD_PENALTY = {"T5": 0.032, "ChemBERTa": 0.041, "BiLSTM": 0.058, "LSTM": 0.072}
METRIC_SCALE = {"acc": 1, "top3": 0.5, "exact": 1.4, "valid": 0.04}
MASK_SCALE = [1, 1.1, 1.25]
E6_PENALTY = 0.055
E8_PENALTY = 0.05
MODEL_ORDER = [m[0] for m in MODELS]


def _penalty(split: str, base: float, metric: str = "acc", mask: int = 0) -> float:
    return base * METRIC_SCALE[metric] * MASK_SCALE[mask] if split == "scaffold" else 0


def _wilson(p: float, n: int = TEST_MOLECULES, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson interval, which stays inside 0 to 1 and narrows near the ends."""
    d = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return round(max(0, mid - half), 3), round(min(1, mid + half), 3)


def _curves(split: str) -> dict:
    out = {}
    for mi, (name, acc, tau, loss, acc0, loss0) in enumerate(MODELS):
        pen = _penalty(split, SCAFFOLD_PENALTY[name])
        rows = {"acc": [], "loss": []}
        seeds = [random.Random(99 + mi * 13 + s * 7) for s in range(3)]
        for e in range(1, 41):
            accs, losses = [], []
            for s, r in enumerate(seeds):
                n = (r.random() - 0.5) * 0.012 * (1 + 6 / e)
                accs.append((acc - pen) * (1 - math.exp(-e / tau)) + acc0 * math.exp(-e / tau) + n + (s - 1) * 0.011)
                losses.append(loss + pen + (loss0 - loss) * math.exp(-e / tau * 1.1) + n * 2.1 + (s - 1) * 0.022)
            for key, vals in (("acc", accs), ("loss", losses)):
                rows[key].append({"epoch": e, "mean": round(sum(vals) / 3, 4), "lo": round(min(vals), 4), "hi": round(max(vals), 4)})
        out[name] = rows
    return out


def _compare(split: str) -> dict:
    out = {}
    for k, v in COMPARE.items():
        values = [round(x - _penalty(split, SCAFFOLD_PENALTY[m], k), 3) for m, x in zip(MODEL_ORDER, v["values"])]
        bounds = [_wilson(x) for x in values]
        out[k] = {**v, "values": values, "lo": [b[0] for b in bounds], "hi": [b[1] for b in bounds]}
    return out


def _sweep(split: str) -> dict:
    out = {}
    for m, vals in SWEEP.items():
        points = [round(v - _penalty(split, SCAFFOLD_PENALTY[m], "acc", i), 3) for i, v in enumerate(vals)]
        out[m] = [{"value": v, "lo": _wilson(v)[0], "hi": _wilson(v)[1]} for v in points]
    return out


def _table(split: str) -> list[dict]:
    c = _compare(split)
    row = lambda i: [c["acc"]["values"][i], c["top3"]["values"][i], c["exact"]["values"][i], c["valid"]["values"][i]]
    fixed = lambda base, vals, mask=0: [round(v - _penalty(split, base, k, mask), 3) for k, v in zip(("acc", "top3", "exact", "valid"), vals)]
    t5 = SCAFFOLD_PENALTY["T5"]
    rows = [
        ("E1", "ECFP", "MLP", "n/a", None),
        ("E2", "SELFIES", "LSTM", "15%", row(3)),
        ("E3", "SELFIES", "BiLSTM", "15%", row(2)),
        ("E4", "SELFIES", "ChemBERTa", "15%", row(1)),
        ("E5", "SELFIES", "T5", "15%", row(0)),
        ("E6", "SELFIES", "CNN + BiLSTM", "15%", fixed(E6_PENALTY, [0.876, 0.983, 0.757, 0.995])),
        ("E7", "SELFIES", "T5", "25%", fixed(t5, [SWEEP["T5"][1], 0.975, 0.704, 0.997], 1)),
        ("E7", "SELFIES", "T5", "35%", fixed(t5, [SWEEP["T5"][2], 0.945, 0.583, 0.995], 2)),
        ("E8", "SELFIES", "VAE", "conditional", [None, None, None, round(0.914 - _penalty(split, E8_PENALTY, "valid"), 3)]),
    ]
    return [{"id": a, "input": b, "model": m, "mask": k, "values": v or [None] * 4} for a, b, m, k, v in rows]


def _confusion(split: str, token_count: int) -> dict:
    """Rows sum to 1 across the eight tokens and Other. The diagonal takes any rounding."""
    pen = _penalty(split, SCAFFOLD_PENALTY["T5"])
    matrix = []
    for i, (row, other) in enumerate(zip(CONFUSION, CONFUSION_OTHER)):
        full = [v * (1 - other) for v in row] + [other]
        diagonal = full[i] - pen
        grow = (1 - diagonal) / (1 - full[i])
        out = [round(v * grow, 3) for v in full]
        out[i] = 0
        out[i] = round(1 - sum(out), 3)
        matrix.append(out)
    return {"tokens": CONFUSION_TOKENS, "matrix": matrix, "tokenCount": token_count}


def _tanimoto(split: str) -> dict:
    """Exact recoveries come from the Exact metric, and only the rest go in the bins."""
    c = _compare(split)
    valid = round(c["valid"]["values"][0] * TEST_MOLECULES)
    exact = round(c["exact"]["values"][0] * TEST_MOLECULES)
    n = len(TANIMOTO_SHAPE)
    # The harder split moves more of the misses towards low similarity.
    tilt = 0.6 if split == "scaffold" else 0
    weights = [w * (1 + tilt * (1 - i / (n - 1))) for i, w in enumerate(TANIMOTO_SHAPE)]
    shares = [w / sum(weights) * (valid - exact) for w in weights]
    bins = [math.floor(x) for x in shares]
    by_remainder = sorted(range(n), key=lambda i: shares[i] - bins[i], reverse=True)
    for i in by_remainder[: valid - exact - sum(bins)]:
        bins[i] += 1
    return {"bins": bins, "exact": exact, "valid": valid, "total": TEST_MOLECULES}


def _rnn_params(vocab: int, bi: bool, emb: int = 192, h: int = 384, layers: int = 3) -> int:
    """Embedding, stacked LSTM, LayerNorm, linear head."""
    factor = 2 if bi else 1
    lstm = lambda d: factor * 4 * ((d + h + 1) * h)
    out = h * factor
    return vocab * emb + lstm(emb) + (layers - 1) * lstm(out) + 2 * out + (out + 1) * vocab


def _roberta_params(vocab: int, layers: int, h: int = 768, ffn: int = 3072, positions: int = 512, types: int = 2) -> int:
    """RobertaForMaskedLM with tied embeddings."""
    embeddings = (vocab + positions + types) * h + 2 * h
    attention = 4 * (h * h + h) + 2 * h
    feed_forward = (h * ffn + ffn) + (ffn * h + h) + 2 * h
    head = (h * h + h) + 2 * h + vocab
    return embeddings + layers * (attention + feed_forward) + head


def _t5_params(vocab: int, layers: int = 6, d: int = 512, ffn: int = 2048, heads: int = 8, kv: int = 64, gated: bool = False, tied: bool = True, buckets: int = 32) -> int:
    """T5ForConditionalGeneration."""
    attention = 4 * d * kv * heads
    feed_forward = (3 if gated else 2) * d * ffn
    encoder = attention + feed_forward + 2 * d
    decoder = 2 * attention + feed_forward + 3 * d
    embeddings = vocab * d * (1 if tied else 2)
    return embeddings + layers * (encoder + decoder) + 2 * buckets * heads + 2 * d


def build(vocab_size: int, funnel: list[dict], sample: int, token_counts: dict[str, int]) -> dict:
    ranked = sorted(token_counts, key=token_counts.get, reverse=True)
    if set(ranked[: len(CONFUSION_TOKENS)]) != set(CONFUSION_TOKENS):
        raise ValueError(f"Confusion tokens aren't the most frequent: {ranked[: len(CONFUSION_TOKENS)]}")
    architectures = [
        {"id": "T5", "layers": "8 + 8 × T5 encoder-decoder, 512, MolT5-small", "checkpoint": "molt5-small-qm9", "params": _t5_params(32128, layers=8, ffn=1024, heads=6, gated=True, tied=False)},
        {"id": "ChemBERTa", "layers": "6 × RoBERTa encoder, 768, ChemBERTa-zinc-base", "checkpoint": "chemberta-zinc-base-qm9", "params": _roberta_params(767, layers=6, positions=514, types=1)},
        {"id": "BiLSTM", "layers": "3 × bidirectional LSTM, 384", "checkpoint": "bilstm-384x3-qm9", "params": _rnn_params(vocab_size, True)},
        {"id": "LSTM", "layers": "3 × LSTM, 384", "checkpoint": "lstm-384x3-qm9", "params": _rnn_params(vocab_size, False)},
    ]
    return {
        "architectures": architectures,
        "vocabSize": vocab_size,
        "splits": {s: {"curves": _curves(s), "compare": _compare(s), "table": _table(s), "sweep": _sweep(s), "confusion": _confusion(s, len(token_counts)), "tanimoto": _tanimoto(s)} for s in ("random", "scaffold")},
        "maskRatios": [15, 25, 35],
        "funnel": funnel + [{"step": "Training set", "count": sample}],
    }
