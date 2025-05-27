import { createAdminBotCommand } from '../BotCommandWithKeywords';
import { formatRarityWeightDisplay } from '@/fishing';

export const fishOddsCommand = createAdminBotCommand('fishingodds', async (params, ctx) => {
    const { broadcasterId, broadcasterName, userDisplayName, userId, userName, msg, say } = ctx;
    const { isBroadcaster, isMod } = msg.userInfo;
    // Zod schema for validation
    say(`Fishing odds: ${formatRarityWeightDisplay()}`);
}, { ignoreCase: true });
