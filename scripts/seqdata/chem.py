"""RDKit and SELFIES helpers. All chemistry shown in the app comes through here."""
import re
from dataclasses import dataclass, field

import selfies as sf
from rdkit import Chem, DataStructs, RDLogger
from rdkit.Chem import AllChem, Crippen, Descriptors, rdFingerprintGenerator, rdMolAlign
from rdkit.Chem import rdMolDescriptors as rd

RDLogger.DisableLog("rdApp.*")
SEED = 1337
_fp = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)
_SMILES_TOKEN = re.compile(r"(\[[^\]]*\]|Cl|Br|[A-Za-z]|%\d\d|\d|[=#()\-:/\\.])")


def mol(smiles: str):
    return Chem.MolFromSmiles(smiles)


def canonical(smiles: str) -> str:
    return Chem.MolToSmiles(mol(smiles), canonical=True, isomericSmiles=False)


def to_selfies(smiles: str) -> str:
    m = mol(canonical(smiles))
    Chem.Kekulize(m, clearAromaticFlags=True)
    return sf.encoder(Chem.MolToSmiles(m, kekuleSmiles=True, isomericSmiles=False))


def tokens_of(smiles: str) -> list[str]:
    return list(sf.split_selfies(to_selfies(smiles)))


def token_kinds(tokens: list[str]) -> list[str]:
    """Label each token atom, ring, branch or size. Size tokens only encode a number."""
    kinds, skip = [], 0
    for t in tokens:
        if skip:
            kinds.append("size")
            skip -= 1
            continue
        m = re.search(r"(Branch|Ring)(\d)", t)
        if m:
            kinds.append(m.group(1).lower())
            skip = int(m.group(2))
        else:
            kinds.append("atom")
    return kinds


def _closures(smiles: str) -> list[tuple[int, int]]:
    atom, open_rings, out = -1, {}, []
    for tok in _SMILES_TOKEN.findall(smiles):
        if tok[0] == "[" or tok[0].isalpha():
            atom += 1
        elif tok[0].isdigit() or tok[0] == "%":
            label = tok.lstrip("%")
            if label in open_rings:
                out.append((open_rings.pop(label), atom))
            else:
                open_rings[label] = atom
    return out


@dataclass
class Decoded:
    selfies: str
    tokens: list[str]
    kinds: list[str]
    smiles: str
    mol: object
    atom_token: list[int] = field(default_factory=list)
    token_bond: dict[int, int] = field(default_factory=dict)


def decode(selfies: str) -> Decoded:
    tokens = list(sf.split_selfies(selfies))
    kinds = token_kinds(tokens)
    smiles, attribution = sf.decoder(selfies, attribute=True)
    m = mol(smiles) if smiles else None
    atom_token = []
    for item in attribution:
        if item.token[0] == "[" or item.token[0].isalpha():
            source = [a.index for a in item.attribution if kinds[a.index] == "atom"]
            atom_token.append(source[-1] if source else item.attribution[-1].index)
    token_bond: dict[int, int] = {}
    if m is not None:
        closures = _closures(smiles)
        for i, kind in enumerate(kinds):
            if kind != "ring":
                continue
            previous = [a for a, t in enumerate(atom_token) if t < i]
            pair = next((c for c in closures if previous and previous[-1] in c), None)
            if pair is None:
                continue
            closures.remove(pair)
            bond = m.GetBondBetweenAtoms(*pair)
            if bond is not None:
                token_bond[i] = bond.GetIdx()
                j = i + 1
                while j < len(kinds) and kinds[j] == "size":
                    token_bond[j] = bond.GetIdx()
                    j += 1
    return Decoded(selfies, tokens, kinds, smiles, m, atom_token, token_bond)


def properties(m) -> dict:
    return {
        "mol_weight": round(Descriptors.MolWt(m), 2),
        "logp": round(Crippen.MolLogP(m), 2),
        "hbd": rd.CalcNumHBD(m),
        "hba": rd.CalcNumHBA(m),
    }


def formula(m) -> str:
    return rd.CalcMolFormula(m)


def fingerprint(m):
    return _fp.GetFingerprint(m)


def tanimoto(a: str, b: str) -> float:
    return round(DataStructs.TanimotoSimilarity(fingerprint(mol(a)), fingerprint(mol(b))), 3)


@dataclass
class Conformer:
    mol: object
    coords: list[list[float]]
    is_3d: bool


def _coords(h) -> list[list[float]]:
    c = h.GetConformer()
    pts = [c.GetAtomPosition(i) for i in range(h.GetNumAtoms())]
    return [[round(p.x, 3), round(p.y, 3), round(p.z, 3)] for p in pts]


def conformer(m) -> Conformer:
    """ETKDG with a fixed seed then MMFF. Falls back to flat 2D if embedding fails."""
    h = Chem.AddHs(m)
    if AllChem.EmbedMolecule(h, randomSeed=SEED) == -1:
        AllChem.Compute2DCoords(h)
        return Conformer(h, _coords(h), False)
    AllChem.MMFFOptimizeMolecule(h)
    return Conformer(h, _coords(h), True)


def align(probe: Conformer, reference: Conformer, pairs: list[tuple[int, int]]) -> Conformer:
    """Superpose probe on reference using (probe atom, reference atom) pairs."""
    if probe.is_3d and reference.is_3d and len(pairs) >= 3:
        rdMolAlign.AlignMol(probe.mol, reference.mol, atomMap=pairs)
        return Conformer(probe.mol, _coords(probe.mol), True)
    return probe
