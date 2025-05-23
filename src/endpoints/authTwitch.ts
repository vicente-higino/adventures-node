import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { Env } from "@/types";
import { exchangeCode } from "@twurple/auth";
import { authProvider, createBot } from "@/bot";
import fs from "fs/promises";
import { z } from "zod";

export class AuthTwitch extends OpenAPIRoute {
    schema = {
        request: {
            query: z.object({
                code: z.string(),
                scope: z.string(),
                state: z.string().optional(),

            })
        }, responses: {}
    };

    async handle(c: Context<Env>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const { code, scope, state } = data.query;
        const url = new URL(c.req.url);
        const redirectUri = url.origin + url.pathname;

        try {
            const tokenData = await exchangeCode(c.env.TWITCH_CLIENT_ID, c.env.TWITCH_CLIENT_SECRET, code, redirectUri);
            const userId = await authProvider.addUserForToken(tokenData);
            await fs.writeFile(`./tokens.${userId}.json`, JSON.stringify(tokenData, null, 4), 'utf-8');
            createBot(userId);
            return c.json({ message: "Token added successfully" });
        } catch (error) {
            console.error("Error exchanging code:", error);
            return c.json({ error: "Failed to exchange code" }, 500);
        }
    }
}

export class AuthTwitchRedirect extends OpenAPIRoute {
    schema = {
        request: {
            query: z.object({
                redirect_uri: z.string().url().optional(),
                scope: z.string().optional(),
                state: z.string().optional(),
            })
        },
        responses: {}
    };

    async handle(c: Context<Env>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const clientId = c.env.TWITCH_CLIENT_ID;
        const url = new URL(c.req.url);
        const redirectUri = data.query.redirect_uri ?? url.origin + "/auth/twitch";
        console.log("Redirect URI:", redirectUri);
        const scope = data.query.scope ?? "chat:read chat:edit user:write:chat user:bot user:read:chat user:manage:chat_color";
        const state = data.query.state ?? "";
        const params = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scope,
        });
        if (state) params.append("state", state);

        const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
        console.log("Twitch Auth URL:", twitchAuthUrl);
        return c.redirect(twitchAuthUrl, 302);
    }
}
