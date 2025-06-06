import { BotCommand, BotCommandContext, CreateBotCommandOptions } from "@twurple/easy-bot";
import { getBotConfig, isChannelLive } from "@/bot";

interface KeywordCommand {
    name: string;
    keywords: string[];
    action: (params: string[], context: BotCommandContext) => void | Promise<void>;
    ignoreCase?: boolean;
}

class BotCommandWithKeywords extends BotCommand {
    private _name: string;
    private _keywords: string[];
    private _ignoreCase: boolean;
    private _action: (params: string[], context: BotCommandContext) => void | Promise<void>;
    constructor(command: KeywordCommand) {
        super();
        this._name = command.name;
        this._keywords = command.keywords;
        this._action = command.action;
        this._ignoreCase = command.ignoreCase ?? false;
    }

    get name(): string {
        return this._name;
    }

    get keywords(): string[] {
        return this._keywords;
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
        await this._action(params, context);
    }
}

export function createBotCommand(
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
            return !isChannelLive(channelId);
        }

        async execute(params: string[], context: BotCommandContext) {
            await handler(params, context);
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

        async execute(params: string[], context: BotCommandContext) {
            await handler(params, context);
        }
    })(options);
}
