import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types";
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { createUserIdParam } from "@/utils/params";
import { handleDuelAccept } from "@/common/handleDuels";

export class DuelAccept extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                challengerId: createUserIdParam("Challenger user id").optional(),
            }),
        },
        responses: {},
    };
    handleValidationError(): Response {
        const msg = "Usage: !accept [username]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userlogin = data.headers["x-fossabot-message-userlogin"];
        const challengedId = data.headers["x-fossabot-message-userproviderid"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const { challengerId } = data.params;

        const result = await handleDuelAccept({
            channelLogin,
            channelProviderId,
            challengedId,
            userlogin,
            userDisplayName,
            challengerId,
        });
        return c.text(result);
    }
}
