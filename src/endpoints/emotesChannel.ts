import { OpenAPIRoute } from "chanfana";
import { type HonoEnv } from "../types";
import type { Context } from "hono";
import { getUserByUsername } from "@/twitch/api";
import { emoteTracker } from "@/bot";
import z from "zod";
import { prisma } from "@/prisma";

export class emotesChannel extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({ username: z.string().min(1) }),
        },
        responses: {},
    };

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const username = data.params.username;

        if (!emoteTracker) {
            return c.json({ message: "Emote tracker not initialized" }, 503);
        }

        const user = await getUserByUsername(prisma, username);
        if (!user) {
            return c.json({ message: "User not found" }, 404);
        }

        const emotesMap = emoteTracker.getChannelEmotes(user.login);
        if (!emotesMap || emotesMap.size === 0) {
            return c.json({ emotes: [], channel: user.login, channelId: user.id });
        }

        // Return emotes as array of objects
        const emotes = Array.from(emotesMap.values()).map(e => ({
            id: e.id,
            name: e.name,
            provider: e.provider,
        }));

        return c.json({
            channel: user.login,
            channelId: user.id,
            emotes,
        });
    }
}
