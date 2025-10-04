import { PrismaClient } from "@prisma/client";
import { DateTime, Str } from "chanfana";
import { z } from "zod";
import { Env } from "./env";

export const ParseAiResponse = z.object({
    response: Str(),
    usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number(), total_tokens: z.number() }),
});
export const Task = z.object({
    name: Str({ example: "lorem" }),
    slug: Str(),
    description: Str({ required: false }),
    completed: z.boolean().default(false),
    due_date: DateTime(),
});

export const FossaHeaders = z.object({
    "x-fossabot-channellogin": z.string(),
    "x-fossabot-channelprovider": z.enum(["twitch", "discord", "youtube"]),
    "x-fossabot-channelproviderid": z.string(),
    "x-fossabot-message-userlogin": z.string(),
    "x-fossabot-message-userdisplayname": z.string().transform(name => decodeURIComponent(name)),
    "x-fossabot-message-userproviderid": z.string(),
    "x-fossabot-customapitoken": z.string(),
});

export const numbersOrAll = (s: z.ZodString) =>
    s
        .regex(/^(all|-?\d+)(?!.+)/gim, { message: "Value amount must be a number or 'all'" })
        .transform(value => {
            if (value.toLowerCase() === "all") {
                return Number.POSITIVE_INFINITY;
            }
            return parseInt(value, 10);
        })
        .refine(n => n > 0, { message: "Value must be bigger or equal to 1" });

export interface Bindings {
    DATABASE_URL: string;
    TWITCH_CLIENT_ID: string;
    TWITCH_CLIENT_SECRET: string;
    COOLDOWN_ADVENTURE_IN_HOURS: number;
    COOLDOWN_FISHING_IN_HOURS: number;
}

export interface HonoEnv {
    Bindings: Env;
    Variables: { prisma: PrismaClient };
}

export const fossaContextSchema = z.object({
    channel: z.object({
        id: z.string(),
        login: z.string(),
        display_name: z.string(),
        avatar: z.string(),
        slug: z.string(),
        broadcaster_type: z.string(),
        provider: z.string(),
        provider_id: z.string(),
        created_at: z.string(),
        stream_timestamp: z.string(),
        is_live: z.boolean(),
    }),
    message: z
        .object({
            id: z.string(),
            content: z.string(),
            provider: z.string(),
            user: z.object({
                provider_id: z.string(),
                login: z.string(),
                display_name: z.string(),
                roles: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
            }),
        })
        .optional(),
});

export type FossaContext = z.infer<typeof fossaContextSchema>;
