import logger from "@/logger";
import { z } from "zod";

const userSchema = z.object({ id: z.string(), username: z.string(), display_name: z.string(), created_at: z.number(), avatar_url: z.string() });

const senventvResSchema = z.object({
    id: z.string(),
    platform: z.string(),
    username: z.string(),
    display_name: z.string(),
    linked_at: z.number(),
    emote_capacity: z.number(),
    emote_set_id: z.string(),
    emote_set: z.object({ id: z.string(), emotes: z.array(z.object({ id: z.string(), name: z.string() })) }),
    user: userSchema,
});

const SEVENTV_URL = (userId: string) => `https://7tv.io/v3/users/twitch/${userId}`;
const SEVENTV_USER_URL = (userId: string) => `https://7tv.io/v3/users/${userId}`;

type seventvResonse = z.infer<typeof senventvResSchema>;
export type seventvUser = z.infer<typeof userSchema>;

async function fetchUser(userId: string): Promise<seventvResonse | null> {
    try {
        const res = await fetch(SEVENTV_URL(userId));
        if (!res.ok) return null;
        const json = await res.json();
        const user = senventvResSchema.safeParse(json);
        if (user.success) return user.data;
    } catch (error) {
        logger.error(error, "Error fetching 7tv user");
        return null;
    }
    return null;
}
export async function fetchSevenTvUser(sevenTvUserId: string): Promise<seventvUser | null> {
    try {
        const res = await fetch(SEVENTV_USER_URL(sevenTvUserId));
        if (!res.ok) return null;
        const json = await res.json();
        const user = userSchema.safeParse(json);
        if (user.success) return user.data;
    } catch (error) {
        logger.error(error, "Error fetching 7tv user");
        return null;
    }
    return null;
}
export async function fetchUsers(usersId: string[]): Promise<{ providerId: string; userRes: seventvResonse | null }[]> {
    try {
        const users = await Promise.all(
            usersId.map(async u => {
                return { providerId: u, userRes: await fetchUser(u) };
            }),
        );
        return users;
    } catch (error) {
        logger.error(error, "Error fetching 7tv user");
        return [];
    }
}
