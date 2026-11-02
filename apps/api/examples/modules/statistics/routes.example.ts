import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { databaseMiddleware } from "../../middleware/database.example";
import { statisticsQuery } from "./input.example";
import { statisticsCachePolicy } from "./middleware.example";
import { getUserStatistics } from "./service.example";
import type { ExampleEnvironment } from "../../context.example";

export const statisticsRoutes = new Hono<ExampleEnvironment>()
  .use("*", statisticsCachePolicy)
  .get("/", databaseMiddleware, sValidator("query", statisticsQuery), async (c) => {
    const statistics = await getUserStatistics(c.get("database"), c.req.valid("query"));
    return c.json(statistics, 200);
  });
