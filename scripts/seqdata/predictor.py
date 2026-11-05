"""Staged predictor. Candidates are plausible because they come from token statistics
over real molecules, while seeded per-model error rates choose whether the top answer
is right. There is no neural network here."""
import hashlib
import random
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import selfies as sf

MODELS = ["T5", "ChemBERTa", "BiLSTM", "LSTM"]
RATES = {"T5": 0.91, "ChemBERTa": 0.88, "BiLSTM": 0.875, "LSTM": 0.67}
SPAN_PENALTY = 0.05
PADDING = ["[C]", "[=C]", "[N]", "[O]", "[=O]", "[F]", "[#C]", "[Ring1]", "[Branch1]", "[=Branch1]", "[=N]", "[#N]"]


@dataclass
class TokenStats:
    uni: Counter = field(default_factory=Counter)
    left: dict = field(default_factory=lambda: defaultdict(Counter))
    right: dict = field(default_factory=lambda: defaultdict(Counter))
    both: dict = field(default_factory=lambda: defaultdict(Counter))

    @classmethod
    def fit(cls, corpus):
        st = cls()
        for selfies in corpus:
            t = ["^", *sf.split_selfies(selfies), "$"]
            for i in range(1, len(t) - 1):
                st.uni[t[i]] += 1
                st.left[t[i - 1]][t[i]] += 1
                st.right[t[i + 1]][t[i]] += 1
                st.both[(t[i - 1], t[i + 1])][t[i]] += 1
        return st

    def ranked(self, left: str, right: str, exclude: set[str]) -> list[str]:
        score = Counter()
        for tok, n in self.both.get((left, right), {}).items():
            score[tok] += n * 8
        for tok, n in self.left.get(left, {}).items():
            score[tok] += n
        for tok, n in self.right.get(right, {}).items():
            score[tok] += n
        for tok, n in self.uni.items():
            score[tok] += n * 0.01
        ordered = sorted(score, key=lambda t: (-score[t], t))
        ordered += [t for t in PADDING if t not in score]
        return [t for t in ordered if t not in exclude]


def _rng(*parts) -> random.Random:
    key = "|".join(str(p) for p in parts).encode()
    return random.Random(int(hashlib.sha256(key).hexdigest()[:16], 16))


def _distribute(top, second, others) -> list[dict]:
    """top and second are (token, p). The remaining probability falls off across others."""
    fixed = [top] + ([second] if second else [])
    used = sum(p for _, p in fixed)
    weights = [0.62, 0.25, 0.09, 0.04][: 5 - len(fixed)]
    total = sum(weights)
    out = fixed + [(t, (1 - used) * w / total) for t, w in zip(others, weights)]
    return sorted(({"token": t, "p": round(p, 3)} for t, p in out), key=lambda c: -c["p"])


def predict(st: TokenStats, name: str, tokens: list[str], model: str, start: int, length: int) -> dict[int, list[dict]]:
    out = {}
    rate = RATES[model] - SPAN_PENALTY * (length - 1)
    for pos in range(start, start + length):
        truth = tokens[pos]
        left = tokens[pos - 1] if pos else "^"
        right = tokens[pos + 1] if pos + 1 < len(tokens) else "$"
        rng = _rng(name, model, start, length, pos)
        alts = st.ranked(left, right, {truth})
        if name == "Aniline" and pos == 0:
            alts = ["[O]"] + [a for a in alts if a != "[O]"]
            top = ("[O]", round(rng.uniform(0.46, 0.53), 3))
            out[pos] = _distribute(top, (truth, 0.31), alts[1:])
            continue
        if name == "Phenol" and model == "T5" and (start, length) == (4, 2):
            out[pos] = _distribute((truth, {4: 0.881, 5: 0.843}[pos]), None, alts)
            continue
        forced = name == "Aniline" and start == 0
        missed = name == "Phenol" and model == "LSTM" and (start, length) == (4, 2)
        if not missed and (forced or rng.random() < rate):
            conf = rng.uniform(max(0.55, rate - 0.06), min(0.985, rate + 0.1))
            out[pos] = _distribute((truth, conf), None, alts)
        else:
            top = rng.uniform(0.4, 0.58)
            out[pos] = _distribute((alts[0], top), (truth, rng.uniform(0.2, top - 0.06)), alts[1:])
    return out
