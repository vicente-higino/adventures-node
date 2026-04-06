import { createWhisperCommand } from "@/bot/whispers";
import logger from "@/logger";

export const echoWhisper = createWhisperCommand(
    "echo",
    async (params, { context: ctx, reply }) => {
        const { senderUserName, messageText } = ctx;
        const echoMessage = params.join(" ");
        if (!echoMessage) {
            return;
        }
        logger.debug({ senderUserName, messageText, echoMessage }, "Echoing whisper");
        reply(`${echoMessage}`);
    },
    { keywords: ["echo2"], aliases: ["ec", "ec1"], ignoreCase: false },
);
