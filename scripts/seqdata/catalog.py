"""Named molecules offered in the app. Membership in QM9 is checked, not assumed."""
import re

from . import chem

GUIDE = [("Ethanol", "CCO"), ("Acetone", "CC(=O)C"), ("Acetic acid", "CC(=O)O"), ("Benzene", "c1ccccc1"), ("Phenol", "Oc1ccccc1"), ("Aniline", "Nc1ccccc1"), ("Fluorobenzene", "Fc1ccccc1"), ("Ethylamine", "CCN")]
MORE = [
    ("Pyridine", "c1ccncc1"), ("Pyrrole", "c1cc[nH]c1"), ("Furan", "c1ccoc1"), ("Imidazole", "c1cnc[nH]1"), ("Pyrimidine", "c1cncnc1"), ("Pyrazine", "c1cnccn1"),
    ("Toluene", "Cc1ccccc1"), ("Benzaldehyde", "O=Cc1ccccc1"), ("Benzoic acid", "OC(=O)c1ccccc1"), ("Anisole", "COc1ccccc1"), ("Benzonitrile", "N#Cc1ccccc1"),
    ("Cytosine", "Nc1cc[nH]c(=O)n1"), ("Uracil", "O=c1cc[nH]c(=O)[nH]1"), ("Thymine", "Cc1c[nH]c(=O)[nH]c1=O"),
    ("Glycine", "NCC(O)=O"), ("Alanine", "CC(N)C(O)=O"), ("Urea", "NC(N)=O"), ("Acetamide", "CC(N)=O"), ("Lactic acid", "CC(O)C(O)=O"), ("Pyruvic acid", "CC(=O)C(O)=O"),
    ("Propanol", "CCCO"), ("Isopropanol", "CC(C)O"), ("Butanol", "CCCCO"), ("Diethyl ether", "CCOCC"), ("Acetaldehyde", "CC=O"), ("Propanal", "CCC=O"), ("Butanone", "CCC(C)=O"),
    ("Propionic acid", "CCC(O)=O"), ("Methyl acetate", "COC(C)=O"), ("Ethyl acetate", "CCOC(C)=O"), ("Ethylene glycol", "OCCO"), ("Glycerol", "OCC(O)CO"),
    ("Cyclohexane", "C1CCCCC1"), ("Cyclopentane", "C1CCCC1"), ("Tetrahydrofuran", "C1CCOC1"), ("Dioxane", "C1COCCO1"), ("Morpholine", "C1COCCN1"), ("Piperidine", "C1CCNCC1"),
    ("Acetonitrile", "CC#N"), ("Acrylonitrile", "C=CC#N"), ("Acrolein", "C=CC=O"), ("Catechol", "Oc1ccccc1O"), ("Hydroquinone", "Oc1ccc(O)cc1"), ("Fluorophenol", "Oc1ccc(F)cc1"), ("Fluoroaniline", "Nc1ccc(F)cc1"),
]
CANDIDATES = [{"name": n, "smiles": s} for n, s in GUIDE + MORE]
LIMIT = 40


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def select(qm9: set[str]) -> list[dict]:
    """Guide molecules always stay. The rest must be in QM9. Non-members are labelled."""
    out = []
    for i, c in enumerate(CANDIDATES):
        canon = chem.canonical(c["smiles"])
        member = canon in qm9
        if i >= len(GUIDE) and (not member or len(out) >= LIMIT):
            continue
        m = chem.mol(canon)
        out.append({"id": slug(c["name"]), "name": c["name"], "smiles": c["smiles"], "canonical": canon, "formula": chem.formula(m), "heavyAtoms": m.GetNumHeavyAtoms(), "source": "QM9" if member else "reference"})
    return out
