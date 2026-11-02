import { mkdir, writeFile } from "node:fs/promises";
import { generateSQLiteDrizzleJson } from "drizzle-kit/api";
import * as schema from "../src/schema";

// 为已应用的 0001_auth.sql 建立快照，不重写历史 SQL。Baseline the applied 0001_auth.sql without rewriting its SQL.
const snapshot = await generateSQLiteDrizzleJson(schema);
const directory = new URL("../migrations/meta/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("0000_snapshot.json", directory), JSON.stringify(snapshot, null, 2));
await writeFile(
  new URL("_journal.json", directory),
  JSON.stringify(
    {
      dialect: "sqlite",
      entries: [{ breakpoints: true, idx: 0, tag: "0001_auth", version: "6", when: Date.now() }],
      version: "7",
    },
    null,
    2,
  ),
);
