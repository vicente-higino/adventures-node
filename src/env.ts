import { z } from "zod";

export const TWITCH_CLIENT_ID = z.string().parse(process.env.TWITCH_CLIENT_ID);
export const TWITCH_CLIENT_SECRET = z.string().parse(process.env.TWITCH_CLIENT_SECRET);
