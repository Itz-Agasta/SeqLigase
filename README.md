# SeqLigase

A molecular sequence reconstruction product. SeqLigase masks part of a molecule's SELFIES sequence, predicts the missing tokens with recurrent and transformer models, and checks the result with chemistry tooling.

> **Status: concept demo.** No model is connected and there's no backend yet. Only early exploratory training runs exist, on SMILES, and their scores differ from what this app shows. Model predictions, confidences, training curves and experiment metrics are simulated, and they show the results we project for a full training run, not measured results. The Lab's Explain result button is the one live model: Gemini writes a short note from those simulated runs and their RDKit values, or a saved Gemini note is shown if the network is down. The chemistry is real: tokens, 3D conformers, decoding, validity and properties are computed with RDKit and `selfies`.

## Develop

Requires [Vite+](https://viteplus.dev) (`vp`) and pnpm.

```bash
vp install
vp dev
```

The Lab's Explain result note needs `GOOGLE_GENERATIVE_AI_API_KEY`, set in `.env` locally (see `.env.example`) and in the Vercel project when deployed. Without it, the saved notes in `public/data/notes.json` are used. After a data rebuild, delete that file and run `node --env-file=.env scripts/build_notes.ts`.

`vp check` runs format, lint and type checks. `vp test` runs unit tests. `pnpm run build` creates the production build.
