import { robotRouter } from "./robot-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  robot: robotRouter,
});

export type AppRouter = typeof appRouter;
