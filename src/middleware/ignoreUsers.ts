import { Context, Next } from "hono";
import { HonoEnv } from "@/types";
import { getBotConfig } from "@/bot";

export const ignoreMiddleware = async (c: Context<HonoEnv>, next: Next) => {
    try {
        const userId = c.req.header("x-fossabot-message-userproviderid")
        const ignoreId = getBotConfig().userId;
        if (userId === ignoreId) {
            return c.text("");
        }
        return next();
    } catch (error) {
        console.error(error);
        return next();
    }
};
