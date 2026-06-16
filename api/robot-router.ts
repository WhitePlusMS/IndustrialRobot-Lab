// api/robot-router.ts
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { robotWaypoints } from "@db/schema";
import { eq } from "drizzle-orm";

export const robotRouter = createRouter({
  // 获取所有记忆点
  listWaypoints: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(robotWaypoints).orderBy(robotWaypoints.createdAt);
  }),

  // 保存记忆点
  saveWaypoint: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        j1: z.number(),
        j2: z.number(),
        j3: z.number(),
        j4: z.number(),
        j5: z.number(),
        j6: z.number(),
        isOrigin: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(robotWaypoints).values({
        name: input.name,
        j1: input.j1,
        j2: input.j2,
        j3: input.j3,
        j4: input.j4,
        j5: input.j5,
        j6: input.j6,
        isOrigin: input.isOrigin ? "1" : "0",
      }).returning({ id: robotWaypoints.id });
      return { success: true, id: result[0]?.id ?? 0 };
    }),

  // 更新记忆点（用于设置原点覆盖）
  updateWaypoint: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        j1: z.number().optional(),
        j2: z.number().optional(),
        j3: z.number().optional(),
        j4: z.number().optional(),
        j5: z.number().optional(),
        j6: z.number().optional(),
        isOrigin: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.j1 !== undefined) updateData.j1 = data.j1;
      if (data.j2 !== undefined) updateData.j2 = data.j2;
      if (data.j3 !== undefined) updateData.j3 = data.j3;
      if (data.j4 !== undefined) updateData.j4 = data.j4;
      if (data.j5 !== undefined) updateData.j5 = data.j5;
      if (data.j6 !== undefined) updateData.j6 = data.j6;
      if (data.isOrigin !== undefined) updateData.isOrigin = data.isOrigin ? "1" : "0";

      await db.update(robotWaypoints).set(updateData).where(eq(robotWaypoints.id, id));
      return { success: true };
    }),

  // 删除记忆点
  deleteWaypoint: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(robotWaypoints).where(eq(robotWaypoints.id, input.id));
      return { success: true };
    }),

  // 获取原点
  getOrigin: publicQuery.query(async () => {
    const db = getDb();
    const results = await db
      .select()
      .from(robotWaypoints)
      .where(eq(robotWaypoints.isOrigin, "1"))
      .limit(1);
    return results[0] || null;
  }),

  // 清除原点（原原点保留为普通记忆点）
  clearOrigin: publicQuery.mutation(async () => {
    const db = getDb();
    await db.update(robotWaypoints).set({ isOrigin: "0" }).where(eq(robotWaypoints.isOrigin, "1"));
    return { success: true };
  }),
});
