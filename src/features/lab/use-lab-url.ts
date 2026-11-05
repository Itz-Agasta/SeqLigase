import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { client } from "@/engine/client";
import { useLab } from "@/state/lab-store";
import { parseLabSearch, serializeLabSearch } from "@/state/url-state";

/** Restores the selection from the URL once, then keeps the URL in step with it. */
export function useLabUrl() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    if (!useLab.getState().record || params.has("mol")) {
      void client
        .catalog()
        .then((entries) => {
          if (!cancelled)
            return useLab
              .getState()
              .load(parseLabSearch(params, new Set(entries.map((e) => e.id))));
        })
        .catch((err: unknown) =>
          useLab.setState({ error: err instanceof Error ? err.message : String(err) }),
        );
    }
    const unsubscribe = useLab.subscribe((state, previous) => {
      if (
        state.selection !== previous.selection &&
        state.record &&
        window.location.pathname === "/"
      ) {
        router.history.replace(`/?${serializeLabSearch(state.selection)}`);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);
}
