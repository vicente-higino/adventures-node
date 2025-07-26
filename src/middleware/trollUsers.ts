import { Context, Next } from "hono";
import { HonoEnv } from "@/types";
import { getBotConfig } from "@/bot";
import { pickRandom } from "@/utils/misc";

export const trollMiddleware = async (c: Context<HonoEnv>, next: Next) => {
    try {
        const userId = c.req.header("x-fossabot-message-userproviderid");
        const trollsId = '86536630';
        if (userId === trollsId && Math.random() > 0.5) {
            return c.text(pickRandom(["peepoHmph", "UHM", "BOOOO", "OuttaPocket", "peepoSitMad", "SideEye"]));
        }
        return next();
    } catch (error) {
        console.error(error);
        return next();
    }
};
