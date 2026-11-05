import { create } from "zustand";
import { client } from "@/engine/client";
import { type MaskRatio, type MaxSpan, pickSpan } from "@/engine/mask";
import type { DisplayedToken } from "@/scene/director";
import type { InferenceClient, ModelId, MoleculeRecord, ReconstructResponse } from "@/engine/types";
import { runLog } from "@/features/runs/run-log";
import { clampSelection, DEFAULT_SELECTION, type LabSelection } from "./url-state";

export type LabStatus = "stale" | "running" | "done";
export type LabView = "original" | "masked" | "reconstructed" | "overlay";
export type MomentPhase = "idle" | "damage" | "reading" | "ligation" | "verify";
export type ResolvedSelection = LabSelection & { start: number };

export interface LabState {
  selection: ResolvedSelection;
  ratio: MaskRatio;
  maxSpan: MaxSpan;
  record: MoleculeRecord | null;
  response: ReconstructResponse | null;
  status: LabStatus;
  view: LabView;
  phase: MomentPhase;
  hoveredToken: number | null;
  showHydrogens: boolean;
  spin: boolean;
  displayed: Record<number, DisplayedToken>;
  pendingRun: ReconstructResponse | null;
  sceneReady: boolean;
  beam: number | null;
  checks: string[];
  error: string | null;
  load: (selection: LabSelection) => Promise<void>;
  setMolecule: (id: string) => Promise<void>;
  setModel: (model: ModelId) => void;
  setMask: (start: number, length: number) => void;
  setMaskPolicy: (policy: { ratio?: MaskRatio; maxSpan?: MaxSpan; seed?: number }) => void;
  setView: (view: LabView) => void;
  toggleDisplay: (key: "showHydrogens" | "spin") => void;
  setPhase: (phase: MomentPhase) => void;
  setHoveredToken: (token: number | null) => void;
  setDisplayed: (displayed: LabState["displayed"]) => void;
  fetchResponse: () => Promise<ReconstructResponse | null>;
  reconstruct: () => Promise<void>;
  finish: (response: ReconstructResponse) => void;
  openRun: (selection: LabSelection) => Promise<void>;
}

const STALE = { status: "stale", response: null, view: "masked", displayed: {} } as const;

export function createLabStore(api: InferenceClient) {
  return create<LabState>((set, get) => ({
    selection: { ...DEFAULT_SELECTION },
    ratio: 25,
    maxSpan: 2,
    record: null,
    response: null,
    status: "stale",
    view: "masked",
    phase: "idle",
    hoveredToken: null,
    showHydrogens: true,
    spin: true,
    displayed: {},
    pendingRun: null,
    sceneReady: false,
    beam: null,
    checks: [],
    error: null,

    async load(selection) {
      try {
        const record = await api.molecule(selection.moleculeId);
        const { ratio, maxSpan } = get();
        const span =
          selection.start === null
            ? pickSpan(record.tokens, ratio, maxSpan, selection.seed)
            : selection;
        const resolved = clampSelection(
          { ...selection, start: span.start, length: span.length },
          record.tokens.length,
        );
        set({ record, selection: resolved, error: null, ...STALE });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    async setMolecule(id) {
      if (get().status === "running") return;
      await get().load({ ...get().selection, moleculeId: id, start: null });
    },

    setModel(model) {
      if (get().status === "running") return;
      set((s) => ({ selection: { ...s.selection, model }, ...STALE }));
    },

    setMask(start, length) {
      if (get().status === "running") return;
      set((s) => ({ selection: { ...s.selection, start, length }, ...STALE }));
    },

    setMaskPolicy(policy) {
      const { status, record, ratio, maxSpan, selection } = get();
      if (status === "running" || !record) return;
      const next = {
        ratio: policy.ratio ?? ratio,
        maxSpan: policy.maxSpan ?? maxSpan,
        seed: policy.seed ?? selection.seed,
      };
      const span = pickSpan(record.tokens, next.ratio, next.maxSpan, next.seed);
      set({
        ratio: next.ratio,
        maxSpan: next.maxSpan,
        selection: { ...selection, ...span, seed: next.seed },
        ...STALE,
      });
    },

    setView: (view) => set({ view }),
    toggleDisplay: (key) => set((s) => ({ [key]: !s[key] })),
    setPhase: (phase) => set({ phase }),
    setHoveredToken: (hoveredToken) => set({ hoveredToken }),
    setDisplayed: (displayed) => set({ displayed }),

    async fetchResponse() {
      const { selection } = get();
      try {
        return await api.reconstruct(selection);
      } catch (err) {
        set({ status: "stale", error: err instanceof Error ? err.message : String(err) });
        return null;
      }
    },

    finish(response) {
      const { record, selection } = get();
      if (record) {
        runLog.add({
          id: `${Date.now()}-${selection.model}`,
          at: Date.now(),
          moleculeId: record.id,
          name: record.name,
          model: selection.model,
          start: selection.start,
          length: selection.length,
          seed: selection.seed,
          exact: response.exact_recovery,
          valid: response.valid,
          tanimoto: response.tanimoto_similarity,
        });
      }
      set({
        response,
        status: "done",
        phase: "idle",
        view: "reconstructed",
        displayed: {},
        error: null,
      });
    },

    async openRun(selection) {
      await get().load(selection);
      const response = await get().fetchResponse();
      if (response)
        set({
          response,
          status: "done",
          phase: "idle",
          view: "reconstructed",
          displayed: {},
          pendingRun: null,
        });
    },

    async reconstruct() {
      if (get().status === "running") return;
      set({ status: "running", error: null });
      const response = await get().fetchResponse();
      if (!response) return;
      if (get().sceneReady)
        set({ pendingRun: response, phase: "damage", displayed: {}, checks: [] });
      else get().finish(response);
    },
  }));
}

export const useLab = createLabStore(client);

if (import.meta.env.DEV) (window as unknown as { __lab: typeof useLab }).__lab = useLab;
