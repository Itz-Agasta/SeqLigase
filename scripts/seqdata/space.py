"""Lays real QM9 molecules out in 3D from their Morgan fingerprints."""
import json
import random
from pathlib import Path

import numpy as np
from rdkit import DataStructs
from sklearn.decomposition import TruncatedSVD

from . import chem

SIZE = 20000


def sample(smiles: list[str], keep: list[str]) -> list[str]:
    rest = sorted(set(smiles) - set(keep))
    return keep + random.Random(chem.SEED).sample(rest, SIZE - len(keep))


def build(selected: list[str], catalog_ids: dict[str, str], out: Path) -> None:
    import umap

    fps = np.zeros((len(selected), 2048), dtype=np.float32)
    formulas, heavy = [], []
    for i, s in enumerate(selected):
        m = chem.mol(s)
        arr = np.zeros(2048, dtype=np.float32)
        DataStructs.ConvertToNumpyArray(chem.fingerprint(m), arr)
        fps[i] = arr
        formulas.append(chem.formula(m))
        heavy.append(m.GetNumHeavyAtoms())
    reduced = TruncatedSVD(n_components=50, random_state=chem.SEED).fit_transform(fps)
    xyz = umap.UMAP(n_components=3, n_neighbors=25, min_dist=0.2, random_state=chem.SEED, n_jobs=1).fit_transform(reduced)
    xyz = (xyz - xyz.mean(axis=0)) / np.abs(xyz - xyz.mean(axis=0)).max()
    data = np.column_stack([xyz, np.array(heavy, dtype=np.float32)]).astype("<f4")
    (out / "space.bin").write_bytes(data.tobytes())
    index = {s: i for i, s in enumerate(selected)}
    (out / "space.json").write_text(json.dumps({"count": len(selected), "stride": 4, "formulas": formulas, "catalog": {cid: index[s] for s, cid in catalog_ids.items() if s in index}}, separators=(",", ":")))
