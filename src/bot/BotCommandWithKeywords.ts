import { BotCommand, BotCommandContext, CreateBotCommandOptions } from "@twurple/easy-bot";
import { getBotConfig, isChannelLive } from "@/bot";
import logger from "@/logger";

interface KeywordCommand {
    name: string;
    keywords: string[];
    action: (params: string[], context: BotCommandContext) => void | Promise<void>;
    ignoreCase?: boolean;
    offlineOnly?: boolean;
}

class BotCommandWithKeywords extends BotCommand {
    private _name: string;
    private _keywords: string[];
    private _ignoreCase: boolean;
    private _offlineOnly: boolean;
    private _action: (params: string[], context: BotCommandContext) => void | Promise<void>;
    constructor(command: KeywordCommand) {
        super();
        this._name = command.name;
        this._keywords = command.keywords;
        this._action = command.action;
        this._ignoreCase = command.ignoreCase ?? false;
        this._offlineOnly = command.offlineOnly ?? true;
    }

    get name(): string {
        return this._name;
    }

    get keywords(): string[] {
        return this._keywords;
    }

    get offlineOnly(): boolean {
        return this._offlineOnly;
    }

    match(line: string, prefix: string): string[] | null {
        let [command, ...params] = line.split(" ");
        if (this.matchesKeyword(line, this._ignoreCase)) {
            return [];
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
    matchesKeyword(input: string, ignoreCase = false): boolean {
        const inputWords = input.split(" ");
        if (!ignoreCase) {
            return this._keywords.some(keyword => inputWords.includes(keyword));
        }
        return this._keywords.some(keyword => inputWords.map(w => w.toLowerCase()).includes(keyword.toLowerCase()));
    }

    async execute(params: string[], context: BotCommandContext): Promise<void> {
        const { userId, userName, userDisplayName, broadcasterId, broadcasterName } = context;
        logger.debug({ userId, userName, userDisplayName, broadcasterId, broadcasterName, params }, `Executing bot command: ${this.name}`);
        try {
            await this._action(params, context);
        } catch (error) {
            logger.error(error, `Bot command ${this.name} error`);
        }
    }
}

export function createBotCommand(
    commandName: string,
    handler: (params: string[], context: BotCommandContext) => void | Promise<void>,
    options: CreateBotCommandOptions & { keywords?: string[]; offlineOnly?: boolean } = {},
): BotCommand {
    return new (class extends BotCommandWithKeywords {
        constructor(private readonly _options: CreateBotCommandOptions) {
            super({
                name: commandName,
                keywords: options.keywords ?? [],
                action: handler,
                ignoreCase: options.ignoreCase ?? false,
                offlineOnly: options.offlineOnly ?? true,
            });
        }

        get aliases() {
            return options.aliases ?? [];
        }

        match(line: string, prefix: string): string[] | null {
            if (!this._options.ignoreCase) {
                return super.match(line, prefix);
            }

            const [command, ...params] = line.split(" ");
            const transformedLine = [command.toLowerCase(), ...params].join(" ");
            return super.match(transformedLine, prefix);
        }

        canExecute(channelId: string, userId: string): boolean {
            if (userId == getBotConfig().userId) return false;
            if (this.offlineOnly) {
                // If the command is offline only, check if the channel is live
                return !isChannelLive({ id: channelId });
            }
            return true;
        }

    })(options);
}
export function createAdminBotCommand(
    commandName: string,
    handler: (params: string[], context: BotCommandContext) => void | Promise<void>,
    options: CreateBotCommandOptions & { keywords?: string[] } = {},
): BotCommand {
    return new (class extends BotCommandWithKeywords {
        constructor(private readonly _options: CreateBotCommandOptions) {
            super({ name: commandName, keywords: options.keywords ?? [], action: handler, ignoreCase: options.ignoreCase ?? false });
        }

        get aliases() {
            return options.aliases ?? [];
        }

        match(line: string, prefix: string): string[] | null {
            if (!this._options.ignoreCase) {
                return super.match(line, prefix);
            }

            const [command, ...params] = line.split(" ");
            const transformedLine = [command.toLowerCase(), ...params].join(" ");
            return super.match(transformedLine, prefix);
        }

        canExecute(channelId: string, userId: string): boolean {
            return userId == getBotConfig().superUserId;
        }

    })(options);
}
