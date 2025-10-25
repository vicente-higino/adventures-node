import { Context } from "hono";
import { FossaHeaders } from "@/types";
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { HonoEnv } from "@/types";
import { handleDuelCreate } from "@/common/handleDuels";

export class DuelCreate extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                challengedId: z.string({ description: "ChallengedId must be a number" }).refine(s => {
                    const n = parseInt(s);
                    return !isNaN(n);
                }),
                wagerAmount: z
                    .string({
                        description: "Silver amount (number, percentage, K/M/B, or 'all')",
                        invalid_type_error: "Wager amount must be a number, percentage (e.g., 50%), K/M/B (e.g., 5k), or 'all'",
                        required_error: "Wager amount is required",
                    })
                    .regex(/^(all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)$/i, {
                        message: "Wager must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), or 'all'",
                    }),
            }),
        },
        responses: {},
    };
    handleValidationError(): Response {
        const msg = "Usage: !duel username [silver(K/M/B)|%|all]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const challengerId = data.headers["x-fossabot-message-userproviderid"];
        const userlogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const { challengedId, wagerAmount: wagerAmountStr } = data.params;

        const result = await handleDuelCreate({
            channelLogin,
            channelProviderId,
            challengerId,
            challengedId,
            userlogin,
            userDisplayName,
            wagerAmountStr,
        });
        return c.text(result);
    }
}
