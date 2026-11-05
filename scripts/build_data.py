# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["rdkit", "selfies", "numpy", "scikit-learn", "umap-learn"]
# ///
"""Regenerates public/data. Run with: uv run scripts/build_data.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from seqdata import catalog, chem, experiments, predictor, qm9, runs, space

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data"


def write(path: Path, data) -> None:
    path.write_text(json.dumps(data, separators=(",", ":"), sort_keys=True))


def main() -> None:
    smiles, funnel = qm9.clean(qm9.download(ROOT / "data/raw/qm9.csv"))
    print(*(f"{f['step']}: {f['count']}" for f in funnel), sep="\n")
    members = set(smiles)
    entries = catalog.select(members)
    outside = [e["name"] for e in entries if e["source"] != "QM9"]
    print(f"Catalog: {len(entries)} molecules. Not in QM9: {outside or 'none'}")

    keep = [e["canonical"] for e in entries if e["source"] == "QM9"]
    selected = space.sample(smiles, keep)
    stats = predictor.TokenStats.fit([chem.to_selfies(s) for s in selected])
    vocab = len(stats.uni) + 5  # [PAD], [BOS], [EOS], [MASK], [UNK]

    for folder in ("molecules", "note-facts"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
        for stale in (OUT / folder).glob("*.json"):
            stale.unlink()
    write(OUT / "catalog.json", entries)
    for entry in entries:
        record = runs.build_record(entry, stats)
        write(OUT / f"molecules/{entry['id']}.json", record)
        write(OUT / f"note-facts/{entry['id']}.json", runs.note_facts(record, members))
        print("built", entry["id"])
    write(OUT / "experiments.json", experiments.build(vocab, funnel, len(selected), dict(stats.uni)))
    space.build(selected, {e["canonical"]: e["id"] for e in entries}, OUT)
    print(f"Vocabulary: {vocab}")


if __name__ == "__main__":
    main()
