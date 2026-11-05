"""Builds one molecule's file: real structure, every run, and each predicted candidate."""
from . import chem, predictor


def _atoms(dec: chem.Decoded, conf: chem.Conformer, original_token_atom=None) -> list[dict]:
    heavy = dec.mol.GetNumAtoms()
    atoms = []
    for i, a in enumerate(conf.mol.GetAtoms()):
        token = dec.atom_token[i] if i < heavy else None
        entry = {"el": a.GetSymbol(), "x": conf.coords[i][0], "y": conf.coords[i][1], "z": conf.coords[i][2], "tokenIndex": token}
        if original_token_atom is not None:
            entry["origIndex"] = original_token_atom.get(token)
        atoms.append(entry)
    return atoms


def _bonds(conf: chem.Conformer) -> list[dict]:
    return [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "order": b.GetBondTypeAsDouble()} for b in conf.mol.GetBonds()]


def _candidate(selfies: str, index: int, original: chem.Decoded, ref: chem.Conformer) -> dict | None:
    dec = chem.decode(selfies)
    if dec.mol is None or dec.mol.GetNumAtoms() == 0:
        return None
    token_atom = {t: a for a, t in enumerate(original.atom_token)}
    pairs = [(a, token_atom[t]) for a, t in enumerate(dec.atom_token) if t in token_atom]
    conf = chem.align(chem.conformer(dec.mol), ref, pairs)
    return {
        "id": f"c{index}",
        "smiles": dec.smiles,
        "selfies": selfies,
        "tokens": dec.tokens,
        "formula": chem.formula(dec.mol),
        "is3d": conf.is_3d,
        "depiction": chem.depiction(dec.mol),
        "atoms": _atoms(dec, conf, token_atom),
        "bonds": _bonds(conf),
        "properties": chem.properties(dec.mol),
    }


def build_record(entry: dict, stats: predictor.TokenStats) -> dict:
    selfies = chem.to_selfies(entry["smiles"])
    dec = chem.decode(selfies)
    conf = chem.conformer(dec.mol)
    tokens = dec.tokens
    props = chem.properties(dec.mol)
    n = len(tokens)
    canon = chem.canonical(dec.smiles)
    candidates: dict[str, dict | None] = {}
    runs = {}
    for model in predictor.MODELS:
        for length in (1, 2, 3):
            for start in range(n - length + 1):
                topk = predictor.predict(stats, entry["name"], tokens, model, start, length)
                predicted = [topk[i][0]["token"] if i in topk else t for i, t in enumerate(tokens)]
                sel = "".join(predicted)
                masked = "".join("[MASK]" if i in topk else t for i, t in enumerate(tokens))
                correct = sum(predicted[i] == tokens[i] for i in topk)
                warnings = [] if conf.is_3d else ["3D embedding failed. Showing the 2D structure."]
                if sel == selfies:
                    cid, smiles, p, tan, exact, valid = "original", dec.smiles, props, 1.0, True, True
                else:
                    if sel not in candidates:
                        candidates[sel] = _candidate(sel, len(candidates), dec, conf)
                    cand = candidates[sel]
                    if cand is None:
                        cid, smiles, p, tan, exact, valid = None, "", {"mol_weight": 0, "logp": 0, "hbd": 0, "hba": 0}, 0.0, False, False
                        warnings.append("The predicted sequence did not decode to a valid molecule.")
                    else:
                        cid, smiles, p, valid = cand["id"], cand["smiles"], cand["properties"], True
                        tan = chem.tanimoto(smiles, dec.smiles)
                        exact = chem.canonical(smiles) == canon
                        if not cand["is3d"]:
                            warnings.append("3D embedding failed. Showing the 2D structure.")
                runs[f"{model}:{start}:{length}"] = {
                    "original_smiles": dec.smiles,
                    "original_selfies": selfies,
                    "masked_selfies": masked,
                    "predicted_selfies": sel,
                    "predicted_smiles": smiles,
                    "mask_positions": sorted(topk),
                    "topk": {str(k): v for k, v in topk.items()},
                    "valid": valid,
                    "token_accuracy": round(correct / length, 3),
                    "exact_recovery": exact,
                    "tanimoto_similarity": tan,
                    "normalized_edit_distance": round((length - correct) / n, 3),
                    "properties": p,
                    "candidate_id": cid,
                    "warnings": warnings,
                }
    return {
        "id": entry["id"],
        "name": entry["name"],
        "smiles": entry["smiles"],
        "source": entry["source"],
        "selfies": selfies,
        "tokens": tokens,
        "tokenKinds": dec.kinds,
        "atomTokens": dec.atom_token,
        "tokenBond": {str(k): v for k, v in dec.token_bond.items()},
        "formula": chem.formula(dec.mol),
        "properties": props,
        "is3d": conf.is_3d,
        "depiction": chem.depiction(dec.mol),
        "atoms": _atoms(dec, conf),
        "bonds": _bonds(conf),
        "candidates": [c for c in candidates.values() if c],
        "runs": runs,
    }

def note_facts(record: dict, members=frozenset()) -> dict:
    """Facts only the written note uses: what each prediction is, and what its runner-up would have made."""
    cache: dict[str, dict | None] = {}

    def analyse(selfies: str) -> dict | None:
        if selfies not in cache:
            dec = chem.decode(selfies)
            ok = dec.mol is not None and dec.mol.GetNumAtoms() > 0
            cache[selfies] = {"smiles": dec.smiles, **chem.analysis(dec.mol, members)} if ok else None
        return cache[selfies]

    runs = {}
    for key, run in record["runs"].items():
        tokens = chem.sf.split_selfies(run["predicted_selfies"])
        tokens = list(tokens)
        pos = min(run["mask_positions"], key=lambda p: run["topk"][str(p)][0]["p"] - run["topk"][str(p)][1]["p"])
        top, second = run["topk"][str(pos)][:2]
        tokens[pos] = second["token"]
        runs[key] = {
            "predicted": analyse(run["predicted_selfies"]),
            "alternative": {"position": pos, "token": second["token"], "p": second["p"], "topToken": top["token"], "topP": top["p"], "result": analyse("".join(tokens))},
        }
    return {"original": analyse(record["selfies"]), "runs": runs}
