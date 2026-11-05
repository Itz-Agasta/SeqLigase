import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Shell } from "@/app/shell";
import { DatasetsPage } from "@/features/datasets/page";
import { ExperimentsPage } from "@/features/experiments/page";
import { RepairLabPage } from "@/features/lab/page";
import { ModelsPage } from "@/features/models/page";
import { RunsPage } from "@/features/runs/page";

const rootRoute = createRootRoute({ component: Shell });
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
