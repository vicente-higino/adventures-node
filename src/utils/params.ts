import { EmoteProvider } from "@prisma/client";
import { z } from "zod";

/**
 * Creates a user ID parameter that transforms "Error" strings to null
 * @param description Optional description for the parameter
 * @param required Whether the parameter is required (defaults to false)
 * @returns A string schema with transformation
 */
export function createUserIdParam(description = "User id") {
    return z.string({ description }).transform(data => {
        return data.includes("Error") ? null : data;
    });
}

const providerAliases: Record<string, EmoteProvider> = {
    twitch: EmoteProvider.Twitch,
    bttv: EmoteProvider.BTTV,
    ffz: EmoteProvider.FFZ,
    "7tv": EmoteProvider.SevenTV,
    seventv: EmoteProvider.SevenTV,
};

export function parseProviders(args: string[]): EmoteProvider[] | null {
    if (!args.length) return null;
    const providers: EmoteProvider[] = [];
    for (const arg of args) {
        const key = arg.toLowerCase();
        if (providerAliases[key]) {
            providers.push(providerAliases[key]);
        }
    }
    return providers.length ? providers : null;
}
