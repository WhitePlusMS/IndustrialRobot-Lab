import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// 机器人配置表
export const robotConfigs = sqliteTable("robot_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  dhParams: text("dhParams", { mode: "json" }).notNull(),
  baseHeight: real("baseHeight").notNull(),
  linkColors: text("linkColors", { mode: "json" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type RobotConfigRecord = typeof robotConfigs.$inferSelect;
export type InsertRobotConfig = typeof robotConfigs.$inferInsert;

// 机器人记忆点/路点表
export const robotWaypoints = sqliteTable("robot_waypoints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  j1: real("j1").notNull(),
  j2: real("j2").notNull(),
  j3: real("j3").notNull(),
  j4: real("j4").notNull(),
  j5: real("j5").notNull(),
  j6: real("j6").notNull(),
  isOrigin: text("isOrigin").default("0").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type RobotWaypoint = typeof robotWaypoints.$inferSelect;
export type InsertRobotWaypoint = typeof robotWaypoints.$inferInsert;
