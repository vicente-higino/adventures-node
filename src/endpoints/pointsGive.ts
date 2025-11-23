import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types";
import { OpenAPIRoute } from "chanfana";
import { giveSilver, giveSilverCommandSyntax, giveSilverParamsSchema } from "@/common/giveSilver";

export class PointGive extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders, params: giveSilverParamsSchema }, responses: {} };
    handleValidationError(): Response {
        const msg = giveSilverCommandSyntax();
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
