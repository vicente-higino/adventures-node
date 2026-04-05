import { GetBot } from "@/bot";
import { createWhisperCommand } from "@/bot/whispers";
import logger from "@/logger";
import { sendWhisper } from "@/twitch/api";

export const echoWhisper = createWhisperCommand(
    "echo",
    async (params, ctx) => {
        const { senderUserName, messageText, reply } = ctx;
        const echoMessage = params.join(" ");
        if (!echoMessage) {
            return;
        }
        logger.debug({ senderUserName, messageText, echoMessage }, "Echoing whisper");
        reply(`${echoMessage}`);

    },
    { keywords: ["echo2"], aliases: ["ec", "ec1"], ignoreCase: false },
);