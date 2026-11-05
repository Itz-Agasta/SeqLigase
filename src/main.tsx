import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initTheme } from "./app/theme";
import { client } from "./engine/client";
import { preloadAll } from "./engine/preload";

initTheme();

const preload = () =>
  void preloadAll(client, [
    () => import("@/scene/stage"),
    () => import("@/features/models/compare-viewport"),
    () => import("@/features/datasets/chemical-space"),
  ]);
if ("requestIdleCallback" in window) requestIdleCallback(preload);
else setTimeout(preload, 500);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
