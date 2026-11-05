import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1600px)";

function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** True where charts get a roomier layout. Matches the `min-[1600px]` variant in the pages. */
export function useWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
