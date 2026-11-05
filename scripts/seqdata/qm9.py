"""Downloads QM9 from the MoleculeNet mirror and runs the guide's cleaning funnel."""
import csv
import urllib.request
from pathlib import Path

from rdkit import Chem

from . import chem

URL = "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/qm9.csv"


def download(path: Path) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print("Downloading QM9...")
        urllib.request.urlretrieve(URL, path)
    return path


def clean(path: Path) -> tuple[list[str], list[dict]]:
    """Returns unique canonical SMILES plus the count remaining after each step."""
    with path.open() as f:
        raw = [row["smiles"] for row in csv.DictReader(f)]
    parsed = [m for m in map(Chem.MolFromSmiles, raw) if m is not None]
    single = [m for m in parsed if len(Chem.GetMolFrags(m)) == 1]
    neutral = [m for m in single if all(a.GetFormalCharge() == 0 for a in m.GetAtoms())]
    unique = sorted({Chem.MolToSmiles(m, canonical=True, isomericSmiles=False) for m in neutral})
    encoded = []
    for smiles in unique:
        try:
            if chem.canonical(chem.decode(chem.to_selfies(smiles)).smiles) == smiles:
                encoded.append(smiles)
        except Exception:
            continue
    funnel = [
        {"step": "QM9 records", "count": len(raw)},
        {"step": "Parsed by RDKit", "count": len(parsed)},
        {"step": "Single component", "count": len(single)},
        {"step": "Neutral", "count": len(neutral)},
        {"step": "Unique canonical", "count": len(unique)},
        {"step": "SELFIES round trip", "count": len(encoded)},
    ]
    return encoded, funnel
