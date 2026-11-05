# SeqLigase

A molecular sequence reconstruction product. SeqLigase masks part of a molecule's SELFIES sequence, predicts the missing tokens with recurrent and transformer models, and checks the result with chemistry tooling.

> **Status: concept demo.** No model has been trained and there's no backend yet. Model predictions, confidences, training curves and experiment metrics are simulated, and they show the targets we plan to test. The chemistry is real: tokens, 3D conformers, decoding, validity and properties are computed with RDKit and `selfies`.

## Develop

Requires [Vite+](https://viteplus.dev) (`vp`) and pnpm.

```bash
vp install
vp dev
```

`vp check` runs format, lint and type checks. `vp test` runs unit tests. `pnpm run build` creates the production build.
