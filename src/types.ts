import { PrismaPg } from "@prisma/adapter-pg";
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
    "x-fossabot-channellogin": Str(),
    "x-fossabot-channelprovider": z.enum(["twitch", "discord", "youtube"]),
    "x-fossabot-channelproviderid": Str(),
    "x-fossabot-message-userlogin": Str(),
    "x-fossabot-message-userdisplayname": Str(),
    "x-fossabot-message-userproviderid": Str(),
    "x-fossabot-customapitoken": Str(),
});

export const numbersOrAll = (s: z.ZodString) =>
    s
        .regex(/^(all|\-?\d+)(?!.+)/gim, { message: "Value amount must be a number or 'all'" })
        .transform(value => {
            if (value.toLowerCase() === "all") {
                return Number.POSITIVE_INFINITY;
            }
            return parseInt(value, 10);
        })
        .refine(n => n > 0, { message: "Value must be bigger or equal to 1" });

export type Bindings = {
    DATABASE_URL: string;
    TWITCH_CLIENT_ID: string;
    TWITCH_CLIENT_SECRET: string;
    COOLDOWN_ADVENTURE_IN_HOURS: number;
    COOLDOWN_FISHING_IN_HOURS: number;
};

export interface HonoEnv {
    Bindings: Env;
    Variables: { prisma: PrismaClient };
}

interface AiResponse {
    response: string;
    usage: Usage;
}

interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
