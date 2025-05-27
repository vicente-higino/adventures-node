import { createAdminBotCommand } from '../BotCommandWithKeywords';
import { resetRarityWeights } from '@/fishing';

export const resetRarityWeightCommand = createAdminBotCommand('resetweights', async (params, ctx) => {
    const { broadcasterId, broadcasterName, userDisplayName, userId, userName, msg, say } = ctx;
    const { isBroadcaster, isMod } = msg.userInfo;
    // Zod schema for validation
    resetRarityWeights();
    say("Fish rarity weights have been reset to their default values!");
}, { ignoreCase: true });
