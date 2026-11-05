import { createStaticClient } from "./static-client";
import type { InferenceClient } from "./types";

export const client: InferenceClient = createStaticClient();
