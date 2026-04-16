import { emoteTracker, getBotConfig } from "@/bot";
import logger from "@/logger";
import { getUsersByUsername } from "@/twitch/api";
import { AtLeastOne } from "@/utils/misc";
import { EventSource } from "eventsource";
import { z } from "zod";
import { fetchUsers } from "./api";

const url = "https://events.7tv.io/v3";


export async function startSevenTVEventApi() {
    const users = await getUsersByUsername(getBotConfig().channels);
    if (!users) {
        logger.info("No users in bot config, skipping starting SevenTV Event API");
        return;
    }
    const ids = users.map(u => u.id);
    new SevenTVEventApi(ids);
}

interface UserInfo {
    id: string;
    providerId: string;
    username: string;
    emote_set_id: string;
}

class SevenTVEventApi {
    private byTwitchId = new Map<string, UserInfo>();
    private bySevenTvId = new Map<string, UserInfo>();
    private byEmoteSetId = new Map<string, UserInfo>();
    private eventSource: EventSource | null = null;
    private subscription_limit: number = 0;
    private session_id: string | null = null;
    constructor(private usersId: string[]) {
        this.start();
    }

    private async start() {
        await this.fetchUsers(this.usersId);
        const params = this.getParams();
        this.eventSource = new EventSource(url + params);
        this.eventSource.addEventListener("dispatch", this.handleEvent);
        this.eventSource.addEventListener("ack", this.handleEvent);
        this.eventSource.addEventListener("hello", this.handleEvent);
    }

    private async restart() {
        if (this.eventSource) {
            this.eventSource.close();
            this.start();
        }
    }

    private async fetchUsers(usersId: string[]) {
        const users = await fetchUsers(usersId);
        for (const { userRes } of users) {
            if (userRes) {
                const userInfo: UserInfo = {
                    emote_set_id: userRes.emote_set_id,
                    id: userRes.user.id,
                    providerId: userRes.id,
                    username: userRes.username,
                };
                logger.debug({ userInfo });
                this.byTwitchId.set(userInfo.providerId, userInfo);
                this.bySevenTvId.set(userInfo.id, userInfo);
                this.byEmoteSetId.set(userInfo.emote_set_id, userInfo);
            }
        }
    }

    public getUser({ providerId, sevenTvId }: AtLeastOne<{ providerId: string; sevenTvId: string }>): UserInfo | null {
        if (providerId) {
            return this.byTwitchId.get(providerId) ?? null;
        }
        if (sevenTvId) {
            return this.bySevenTvId.get(sevenTvId) ?? null;
        }
        return null;
    }
    private getParams(): string | null {
        const sevenTvUsers = this.byTwitchId.values().toArray();
        const emotes = sevenTvUsers.map(u => u.emote_set_id);
        const users = sevenTvUsers.map(u => u.id);
        const emoteSets = emotes.map(e => `emote_set.update<object_id=${e}>`).join(",");
        const usersSets = users.map(e => `user.update<object_id=${e}>`).join(",");
        const params = [emoteSets, usersSets].join(",");
        logger.debug({ params }, "SevenTV Event Params");
        return encodeURIComponent(`@${params}`);
    }

    private handleEvent = async (e: MessageEvent) => {
        const event = parseEvent(e);
        if (event.type == "dispatch") {
            const { data } = event;
            logger.debug({ type: "dispatch", data: data.type }, "SevenTV Event Message");
            if (data.type == "user.update") {
                // Emote set changed
                const { id } = data.body;
                const userInfo = this.bySevenTvId.get(id)!;
                emoteTracker?.refreshEmotes(userInfo.username, { seventv: true, ffz: false, bttv: false });
                this.restart(); // restart is needed bc theres no way to update the subscriptions
                // if (updated) {
                //     const parsed = updatedSchema.safeParse(updated);
                //     if (parsed.success) {
                //         const { old_value, value } = parsed.data[0].value[1];
                //         const userInfo = this.byEmoteSetId.get(old_value)!;
                //         const newUserInfo: UserInfo = { ...userInfo, emote_set_id: value };
                //         this.bySevenTvId.set(newUserInfo.id, newUserInfo);
                //         this.byTwitchId.set(newUserInfo.providerId, newUserInfo);
                //         this.byEmoteSetId.set(newUserInfo.emote_set_id, newUserInfo);
                //     }
                // }
            }
            if (data.type == "emote_set.update") {
                // Emote added or removed from set
                const { id } = data.body;
                const userInfo = this.byEmoteSetId.get(id)!;
                emoteTracker?.refreshEmotes(userInfo.username, { seventv: true, ffz: false, bttv: false });
            }
        }
        if (event.type == "hello") {
            const { data } = event;
            logger.debug({ type: "hello", data }, "SevenTV Event Message");
            this.session_id = data.session_id;
            this.subscription_limit = data.subscription_limit;
        }
        if (event.type == "ack") {
            const { data } = event;
            logger.debug({ type: "ack", data }, "SevenTV Event Message");
            this.subscription_limit--;
        }
    };
}
const updatedSchema = z.array(
    z.object({
        value: z.tuple([
            z.object({
                key: z.literal("emote_set"),
                old_value: z.object({ id: z.string(), name: z.string() }),
                value: z.object({ id: z.string(), name: z.string() }),
            }),
            z.object({ key: z.literal("emote_set_id"), old_value: z.string(), value: z.string() }),
        ]),
    }),
);

export type EventName = "dispatch" | "hello" | "heartbeat" | "reconnect" | "ack" | "error" | "end_of_stream";

export interface SSEMessage<T = unknown> {
    event: EventName;
    data: T;
}

export interface HelloPayload {
    heartbeat_interval: number;
    session_id: string;
    subscription_limit: number;
}

export interface HeartbeatPayload {
    count: number;
}

export interface AckPayload<T = unknown> {
    command: string;
    data: T;
}

export interface DispatchPayload {
    type: EventType;
    body: ChangeMap;
}

export interface ChangeMap {
    id: string;
    kind: number;
    contextual?: boolean;
    actor: User;

    added?: ChangeField[];
    updated?: ChangeField[];
    removed?: ChangeField[];
    pushed?: ChangeField[];
    pulled?: ChangeField[];
}

export interface ChangeField<T extends boolean = false> {
    key: string;
    index?: number;
    nested: T;
    old_value: unknown | null;
    // recursive structure
    value: T extends true ? ChangeField<false>[] : unknown | ChangeField<false>[] | null;
}

export interface User {
    id: string;
    username?: string;
    display_name?: string;
}

export type EventType =
    | "system.announcement"
    | "emote.create"
    | "emote.update"
    | "emote.delete"
    | "emote_set.create"
    | "emote_set.update"
    | "emote_set.delete"
    | "user.create"
    | "user.update"
    | "user.delete"
    | "user.add_connection"
    | "user.update_connection"
    | "user.delete_connection"
    | "cosmetic.create"
    | "cosmetic.update"
    | "cosmetic.delete"
    | "entitlement.create"
    | "entitlement.update"
    | "entitlement.delete"
    | `${string}.*`; // wildcard support

export type EventPayloadMap = {
    hello: HelloPayload;
    heartbeat: HeartbeatPayload;
    ack: AckPayload;
    error: { message: string };
    reconnect: {};
    dispatch: DispatchPayload;
};
export type TypedSSEEvent = { [K in keyof EventPayloadMap]: { type: K; data: EventPayloadMap[K] } }[keyof EventPayloadMap];

export function parseEvent(event: MessageEvent): TypedSSEEvent {
    const data = JSON.parse(event.data);
    return { type: event.type as keyof EventPayloadMap, data } as TypedSSEEvent;
}
