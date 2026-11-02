import type { Database } from "@ai-interview/db";
import type { ApiBindings } from "../src/env";

export interface ExampleEnvironment {
  Bindings: ApiBindings;
  Variables: { database: Database };
}
