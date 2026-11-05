import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Shell } from "@/app/shell";
import { DatasetsPage } from "@/features/datasets/page";
import { ExperimentsPage } from "@/features/experiments/page";
import { RepairLabPage } from "@/features/lab/page";
import { ModelsPage } from "@/features/models/page";
import { RunsPage } from "@/features/runs/page";

const rootRoute = createRootRoute({
  component: Shell,
  errorComponent: () => (
    <div role="alert" className="grid h-full place-items-center p-6 text-center">
      <div>
        <p className="mb-1 font-medium">This view stopped working</p>
        <p className="text-muted-foreground mb-3">
          Reload the page to carry on. Your selection is kept in the address bar.
        </p>
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  ),
});
const pages = [
  ["/", RepairLabPage],
  ["/runs", RunsPage],
  ["/experiments", ExperimentsPage],
  ["/models", ModelsPage],
  ["/datasets", DatasetsPage],
] as const;

export const router = createRouter({
  routeTree: rootRoute.addChildren(
    pages.map(([path, component]) =>
      createRoute({ getParentRoute: () => rootRoute, path, component }),
    ),
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
