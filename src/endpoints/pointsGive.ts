import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types";
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { createUserIdParam } from "@/utils/params";
import { giveSilver } from "@/common/giveSilver";

export class PointGive extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                userId: createUserIdParam(),
                giveAmount: z
                    .string({ description: "Silver amount to give ('all', number, or percentage)", required_error: "Silver amount is required" })
                    .regex(/^(all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)$/i, {
                        message: "Amount must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), or 'all'",
                    }),
            }),
        },
        responses: {},
    };
    handleValidationError(): Response {
        const msg = "Usage: !givesilver [username] [silver|K/M/B|%|all]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userlogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const giveAmountStr = data.params.giveAmount;
        const toUserProviderId = data.params.userId ?? data.headers["x-fossabot-message-userproviderid"];

        const result = await giveSilver({
            prisma,
            channelLogin,
            channelProviderId,
            fromUserProviderId: userProviderId,
            fromUserLogin: userlogin,
            fromUserDisplayName: userDisplayName,
            toUserProviderId,
            giveAmountStr,
        });

        return c.text(result.message);
    }
}
