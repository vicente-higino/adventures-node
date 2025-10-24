import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { HonoEnv } from "@/types";
import { exchangeCode } from "@twurple/auth";
import { refreshingAuthProvider, createBot, updateBotConfig } from "@/bot";
import fs from "fs/promises";
import { z } from "zod";
import { getUserById } from "@/twitch/api";
import { prisma } from "@/prisma";

// Global set to store valid OAuth states
const validOAuthStates = new Set<string>();

function generateRandomState(length = 32) {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

export class AuthTwitch extends OpenAPIRoute {
    schema = { request: { query: z.object({ code: z.string(), scope: z.string(), state: z.string().optional() }) }, responses: {} };

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { code, state } = data.query;
        // Validate state
        if (!state || !validOAuthStates.has(state)) {
            return c.json({ error: "Invalid or missing OAuth state. Please try the authentication process again." }, 400);
        }
        // Remove state after use to prevent replay
        validOAuthStates.delete(state);

        const redirectUri = c.env.TWTICH_REDIRECT_URI;
        if (!redirectUri) {
            return c.json({ error: "Server configuration error: Redirect URI is not set." }, 500);
        }

        try {
            const tokenData = await exchangeCode(c.env.TWITCH_CLIENT_ID, c.env.TWITCH_CLIENT_SECRET, code, redirectUri);
            const userId = await refreshingAuthProvider.addUserForToken(tokenData);
            const user = await getUserById(prisma, userId);
            if (!user) {
                return c.text("Failed to add user: Unable to retrieve user information from Twitch.", 500);
            }
            await fs.writeFile(`./secrets/tokens.${userId}.json`, JSON.stringify(tokenData, null, 4), "utf-8");
            await updateBotConfig({ userId });
            await createBot();
            return c.text(`Twitch user "${user.login}" was successfully added and authenticated.`);
        } catch (error) {
            console.error("Error exchanging code:", error);
            return c.text("An error occurred while exchanging the authorization code. Please try again later.", 500);
        }
    }
}

export class AuthTwitchRedirect extends OpenAPIRoute {
    schema = {
        request: { query: z.object({ redirect_uri: z.string().url().optional(), scope: z.string().optional(), state: z.string().optional() }) },
        responses: {},
    };

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const clientId = c.env.TWITCH_CLIENT_ID;

        const redirectUri = c.env.TWTICH_REDIRECT_URI;
        if (!redirectUri) {
            return c.json({ error: "Server configuration error: Redirect URI is not set." }, 500);
        }
        const scope =
            data.query.scope ?? "chat:read chat:edit user:write:chat user:bot user:read:chat user:manage:chat_color user:read:moderated_channels";
        // Generate random state if not provided
        let state = data.query.state;
        if (!state) {
            state = generateRandomState(24);
        }
        validOAuthStates.add(state);
        const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: scope });
        if (state) params.append("state", state);

        const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
        console.log("Twitch Auth URL:", twitchAuthUrl);
        return c.text(`To authenticate with Twitch, please visit the following URL:\n\n${twitchAuthUrl}`);
    }
}
