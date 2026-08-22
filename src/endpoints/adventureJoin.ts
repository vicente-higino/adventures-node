import { OpenAPIRoute } from "chanfana";
import { HonoEnv, FossaHeaders } from "@/types";
import { Context } from "hono";
import { adventureCommandSyntax, AdventureJoinParamsSchema, generatePayoutRate, handleAdventureJoin } from "@/common/handleAdventure";
import { z } from "zod";

export { generatePayoutRate };

// Store timers per adventure to allow clearing if adventure ends early
export class AdventureJoin extends OpenAPIRoute {
    schema = {
        request: { headers: FossaHeaders, params: AdventureJoinParamsSchema, query: z.object({ approach: z.string().optional() }) },
        responses: {},
    };
    handleValidationError() {
        return new Response(adventureCommandSyntax(), { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userLogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const amountParam = data.params.amount.trim();
        const approachParam = data.query.approach?.trim();
        const requestId = data.headers["x-fossabot-message-id"];

        const result = await handleAdventureJoin({
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
            amountParam,
            approachParam,
            requestId,
        });
        return c.text(result);
    }
}
