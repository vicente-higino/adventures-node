import { OpenAPIRoute } from "chanfana";
import { HonoEnv, FossaHeaders } from "@/types";
import { Context } from "hono";
import { adventureCommandSyntax, AdventureJoinParamsSchema, handleAdventureJoin } from "@/common/handleAdventure";

/**
 * Generates a payout rate for the adventure, with 1.3x being most common
 * and max of 2.0x
 *
 * @returns A number between 1.3 and 2.0 representing the payout multiplier
 */
export function generatePayoutRate(): number {
    // Random chance to get higher multipliers
    const rand = Math.random();
    if (rand > 0.975) {
        // 2.5% chance for max payout (2.0x)
        return 2.0;
    } else if (rand > 0.925) {
        // 5% chance for high payout (1.7-1.9x)
        return 1.7 + Math.random() * 0.2;
    } else if (rand > 0.65) {
        // 27.5% chance for medium payout (1.5-1.6x)
        return 1.5 + Math.random() * 0.1;
    } else {
        // 65% chance for standard payout (1.3-1.4x)
        return 1.3 + Math.random() * 0.1;
    }
}

// Store timers per adventure to allow clearing if adventure ends early
export class AdventureJoin extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: AdventureJoinParamsSchema,
        },
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

        const result = await handleAdventureJoin({
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
            amountParam,
        });
        return c.text(result);
    }
}
