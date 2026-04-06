import logger from "@/logger";
import { Bot } from "@twurple/easy-bot";
import { EventSubUserWhisperMessageEvent } from "@twurple/eventsub-base";
import { GetBot } from ".";
import { sendWhisper } from "@/twitch/api";

type WhisperContext = { context: EventSubUserWhisperMessageEvent; reply: (message: string) => Promise<void> };

interface WhisperCommand {
    name: string;
    keywords: string[];
    aliases: string[];
    action: (params: string[], context: WhisperContext) => void | Promise<void>;
    ignoreCase?: boolean;
}

class Whispers {
    private _name: string;
    private _keywords: string[];
    private _aliases: string[];
    private _ignoreCase: boolean;
    private _action: (params: string[], context: WhisperContext) => void | Promise<void>;

    constructor(whisper: WhisperCommand) {
        this._name = whisper.name;
        this._keywords = whisper.keywords;
        this._action = whisper.action;
        this._ignoreCase = whisper.ignoreCase ?? false;
        this._aliases = whisper.aliases ?? [];
    }

    get name(): string {
        return this._name;
    }

    get keywords(): string[] {
        return this._keywords;
    }

    get aliases(): string[] {
        return this._aliases;
    }

    private _match(line: string, prefix: string): string[] | null {
        let [command, ...params] = line.split(" ");
        if (this.matchesKeyword(line, this._ignoreCase)) {
            return [command, ...params];
        }
        if (!command.startsWith(prefix)) {
            return null;
        }
        command = command.slice(prefix.length);
        if (command === this.name || this.aliases.includes(command)) {
            return params;
        }
        return null;
    }

    match(line: string, prefix: string): string[] | null {
        if (!this._ignoreCase) {
            return this._match(line, prefix);
        }

        const [command, ...params] = line.split(" ");
        const transformedLine = [command.toLowerCase(), ...params].join(" ");
        return this._match(transformedLine, prefix);
    }
    matchesKeyword(input: string, ignoreCase = false): boolean {
        const inputWords = input.split(" ");
        if (!ignoreCase) {
            return this._keywords.some(keyword => inputWords.includes(keyword));
        }
        return this._keywords.some(keyword => inputWords.map(w => w.toLowerCase()).includes(keyword.toLowerCase()));
    }

    private createContextWithReply(context: EventSubUserWhisperMessageEvent): WhisperContext {
        const reply = async (message: string) => {
            await sendWhisper(GetBot()?.api!, context.userId, context.senderUserId, message);
        };
        return { context, reply } as WhisperContext;
    }

    async execute(params: string[], context: EventSubUserWhisperMessageEvent): Promise<void> {
        const { senderUserId, senderUserName, messageText } = context;
        logger.debug({ senderUserId, senderUserName, messageText, params }, `Executing whisper command: ${this.name}`);
        try {
            await this._action(params, this.createContextWithReply(context));
        } catch (error) {
            logger.error(error, `Whisper command ${this.name} error`);
        }
    }
}

export function createWhisperCommand(
    whisperName: string,
    handler: (params: string[], context: WhisperContext) => void | Promise<void>,
    options: { aliases?: string[]; keywords?: string[]; ignoreCase?: boolean } = {},
): Whispers {
    return new Whispers({
        name: whisperName,
        keywords: options.keywords ?? [],
        action: handler,
        ignoreCase: options.ignoreCase ?? false,
        aliases: options.aliases ?? [],
    });
}

export default Whispers;
