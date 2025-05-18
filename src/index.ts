import { fromHono } from "chanfana";
import { Context, Hono } from "hono";
import { serve } from "@hono/node-server";
import { PointUpdate } from "endpoints/pointsUpdate";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { AdventureJoin } from "endpoints/adventureJoin";
import { AdventureEnd } from "endpoints/adventureEnd";
import { PointAdd } from "endpoints/pointsAdd";
import { PointGive } from "endpoints/pointsGive";
import { Fish } from "endpoints/fish";
import { FishCount } from "endpoints/fishCount";
import { AdventureStats } from "endpoints/adventureStats";
import { ConsolidatedLeaderboard } from "endpoints/leaderboard";
import { DuelCreate } from "endpoints/duelsCreate";
import { DuelAccept } from "endpoints/duelsAccept";
import { DuelCancel } from "endpoints/duelsCancel";
import { PrismaClient } from "@prisma/client"; // Import PrismaClient
import { Point } from "./endpoints/points";
import { Env } from "types";
import { PrismaPg } from "@prisma/adapter-pg";
import { authMiddleware } from "./middleware/authMiddleware";
import { LastFish } from "endpoints/lastFish";
import env from "env";

// Start a Hono app
const hono = new Hono<Env>();

// Setup OpenAPI registry
const app = fromHono(hono);
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
app.use(logger());

// Add validation middleware before routes

app.use("*", timeout(9500, new HTTPException(408, { message: "oopsie Something went wrong. Please try again in a few seconds." })));

app.use("/api/*", authMiddleware);

app.use("*", (c, next) => {
    c.env = env
    c.set("prisma", prisma);
    return next();
});

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

serve({ fetch: app.fetch, port: 8000 });
