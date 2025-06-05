import { OpenAPIRoute } from "chanfana";
import { type HonoEnv, FossaHeaders } from "../types";
import { fishForUser } from "../common/fishForUser";
import type { Context } from "hono";

export class Fish extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders }, responses: {} };
    async handle(c: Context<HonoEnv>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");

        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userLogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];

        // Call the decoupled fishing logic
        const result = await fishForUser({
            prisma,
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
            cooldownHours: c.env.COOLDOWN_FISHING_IN_HOURS,

        });

        return c.text(result);
    }
}
