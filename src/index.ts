import { fromHono } from "chanfana";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { PointUpdate } from "@/endpoints/pointsUpdate";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { AdventureJoin } from "@/endpoints/adventureJoin";
import { AdventureEnd } from "@/endpoints/adventureEnd";
import { PointAdd } from "@/endpoints/pointsAdd";
import { PointGive } from "@/endpoints/pointsGive";
import { Fish } from "@/endpoints/fish";
import { FishCount } from "@/endpoints/fishCount";
import { AdventureStats } from "@/endpoints/adventureStats";
import { ConsolidatedLeaderboard } from "@/endpoints/leaderboard";
import { DuelCreate } from "@/endpoints/duelsCreate";
import { DuelAccept } from "@/endpoints/duelsAccept";
import { DuelCancel } from "@/endpoints/duelsCancel";
import { Point } from "@/endpoints/points";
import { HonoEnv } from "@/types";
import { LastFish } from "@/endpoints/lastFish";
import env from "@/env";
import { createBot } from "@/bot";
import { prisma } from "@/prisma";
import { AuthTwitch, AuthTwitchRedirect } from "./endpoints/authTwitch";
import { bearerAuth } from "hono/bearer-auth";
import { startCron } from "./cron";
// Start a Hono app
const hono = new Hono<HonoEnv>();

// Error handling middleware

// Setup OpenAPI registry
const app = fromHono(hono);

createBot().catch(e => console.error);
app.use(logger());

// Add validation middleware before routes
app.use("*", timeout(9500, new HTTPException(408, { message: "oopsie Something went wrong. Please try again in a few seconds." })));

// app.use("/api/*", authMiddleware);
// Add health endpoint
app.get("/health", async c => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return c.text("ok");
    } catch (e) {
        console.error(e);
        return c.text("db error", 500);
    }
});

app.use("*", (c, next) => {
    c.env = env;
    c.set("prisma", prisma);
    return next();
});

// Register the new endpoint
app.get("/auth/twitch", AuthTwitch);
app.use("/auth/twitch/login", bearerAuth({ token: env.TWTICH_EVENTSUB_SECRET }));
app.get("/auth/twitch/login", AuthTwitchRedirect);

app.use("*", bearerAuth({ token: env.TWITCH_CLIENT_SECRET }));
// Register OpenAPI endpoints
app.get("/api/points/:userId", Point);
app.get("/api/points/update/:userId/:newBalance", PointUpdate);
app.get("/api/points/add/:userId/:add", PointAdd);
app.get("/api/points/give/:userId/:giveAmount", PointGive);
app.get("/api/adventures/join/:amount", AdventureJoin);
app.get("/api/adventures/end", AdventureEnd);
app.get("/api/adventures/stats/:userId", AdventureStats);
app.get("/api/fish", Fish);
app.get("/api/fish/count/:userId", FishCount);
app.get("/api/fish/last/", LastFish);
app.get("/api/fish/last/:query", LastFish);
app.get("/api/duel/create/:challengedId/:wagerAmount", DuelCreate);
app.get("/api/duel/accept/:challengerId", DuelAccept);
app.get("/api/duel/cancel/:challengedId", DuelCancel);

app.get("/api/leaderboard/:amount/:sortBy", ConsolidatedLeaderboard);

// Add the last fish endpoint
startCron();

serve({ fetch: app.fetch, port: 8000 });
