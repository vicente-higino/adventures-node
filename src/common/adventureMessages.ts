import { formatSilver } from "@/utils/misc";

export interface AdventureChatPlayerResult {
    displayName: string;
    roll: number;
    modifier: number;
    total: number;
    chancePercent: number;
    success: boolean;
    criticalCode: "critical-success" | "critical-failure" | null;
    narrative: string;
    profit: number;
    streakBonus: number;
    streak: number;
    xpAwarded: number;
    lootName?: string;
    lootEquipped?: boolean;
    statusName?: string;
}

export interface AdventureChatResultInput {
    title: string;
    intro: string;
    payoutRate: number;
    presentationMode: "individual" | "grouped";
    epilogue?: string;
    players: readonly AdventureChatPlayerResult[];
}

const FOSSABOT_MESSAGE_LIMIT = 1440;
const MIN_STORY_TARGET = 60;

function splitOversizedWord(word: string, maximumCharacters: number): string[] {
    const chunks: string[] = [];
    let chunk = "";
    for (const character of word) {
        if ((chunk + character).length > maximumCharacters) {
            if (chunk) chunks.push(chunk);
            chunk = character;
        } else {
            chunk += character;
        }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
}

/** Splits at word boundaries using Fossabot's character limit. */
export function splitAdventureChatMessage(message: string, maximumCharacters = FOSSABOT_MESSAGE_LIMIT): string[] {
    if (!Number.isSafeInteger(maximumCharacters) || maximumCharacters < 1) {
        throw new RangeError("maximumCharacters must be a positive integer");
    }
    const words = message.trim().split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maximumCharacters) {
            current = candidate;
            continue;
        }
        if (current) chunks.push(current);
        const wordChunks = splitOversizedWord(word, maximumCharacters);
        chunks.push(...wordChunks.slice(0, -1));
        current = wordChunks.at(-1) ?? "";
    }
    if (current) chunks.push(current);
    return chunks;
}

function fitAdventureChatMessage(message: string, maximumCharacters = FOSSABOT_MESSAGE_LIMIT): string {
    const chunks = splitAdventureChatMessage(message, maximumCharacters);
    if (chunks.length <= 1) return chunks[0] ?? "";
    const ellipsisLength = "…".length;
    if (maximumCharacters <= ellipsisLength) return "…";
    const first = splitAdventureChatMessage(message, maximumCharacters - ellipsisLength)[0] ?? "";
    return `${first}…`;
}

function cleanAdventureProse(message: string): string {
    return message
        .replace(/\s*(?:--+|[—–])\s*/g, ", ")
        .replace(/\s+,/g, ",")
        .replace(/,\s*,+/g, ", ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function formatResultMessage(input: AdventureChatResultInput): string {
    const parts = [...input.players.map(player => cleanAdventureProse(player.narrative)), cleanAdventureProse(input.epilogue ?? "")].filter(Boolean);
    const uniqueParts = parts.filter((part, index) => parts.indexOf(part) === index);
    const fullNarrative = uniqueParts.join(" ");
    if (fullNarrative.length <= FOSSABOT_MESSAGE_LIMIT) return fullNarrative;

    const visible: string[] = [];
    for (let index = 0; index < uniqueParts.length; index += 1) {
        const remaining = uniqueParts.length - index - 1;
        const suffix = remaining > 0 ? ` ${remaining} other adventurer${remaining === 1 ? "" : "s"} faced the challenge.` : "";
        const candidate = `${visible.join(" ")}${visible.length ? " " : ""}${uniqueParts[index]}${suffix}`;
        if (candidate.length > FOSSABOT_MESSAGE_LIMIT) break;
        visible.push(uniqueParts[index]);
    }
    const remaining = uniqueParts.length - visible.length;
    if (visible.length === 0) return "The party faced the challenge, but the full tale was too long to recount.";
    return `${visible.join(" ")}${remaining > 0 ? ` ${remaining} other adventurer${remaining === 1 ? "" : "s"} faced the challenge.` : ""}`;
}

function formatEntryList(entries: readonly string[], maximumVisible: number): string {
    const visible = entries.slice(0, maximumVisible);
    const remaining = entries.length - visible.length;
    return `${visible.join(", ")}${remaining > 0 ? `, and ${remaining} other${remaining === 1 ? "" : "s"}` : ""}`;
}

function formatRewardsMessage(input: AdventureChatResultInput): string {
    const winners = input.players.filter(player => player.success);
    const winnerRewards = winners.map(player => {
        const streak = player.streakBonus > 0 ? `, +${formatSilver(player.streakBonus)} silver bonus, ${player.streak}-win streak` : "";
        const critical = player.criticalCode === "critical-success" ? ", critical success" : "";
        return `@${player.displayName} (+${formatSilver(player.profit)} silver${streak}${critical})`;
    });
    const recoveryBonuses = input.players
        .filter(player => !player.success && player.streakBonus > 0)
        .map(player => {
            const critical = player.criticalCode === "critical-failure" ? ", critical failure" : "";
            return `@${player.displayName} (+${formatSilver(player.streakBonus)} silver bonus, ${player.streak}-lose streak${critical})`;
        });
    const loot = input.players
        .filter(player => player.lootName)
        .map(player => `@${player.displayName} found ${player.lootName}${player.lootEquipped ? " and equipped it" : ""}`);
    const statuses = input.players
        .filter(player => player.statusName)
        .map(player => {
            const critical = player.criticalCode === "critical-failure" && player.streakBonus === 0 ? " (critical failure)" : "";
            return `@${player.displayName}${critical} is now ${player.statusName}`;
        });
    const outcome = winnerRewards.length
        ? `Survivors are: ${formatEntryList(winnerRewards, winnerRewards.length)}.`
        : "No survivors. All players lost their silver.";
    const sections = [
        `The adventure ended with a ${input.payoutRate.toFixed(2)}x payout rate!`,
        outcome,
        recoveryBonuses.length ? `Recovery bonuses: ${formatEntryList(recoveryBonuses, recoveryBonuses.length)}.` : "",
        loot.length ? `${formatEntryList(loot, loot.length)}.` : "",
        statuses.length ? `${formatEntryList(statuses, statuses.length)}.` : "",
    ].filter(Boolean);
    const fullRewards = sections.join(" ");
    if (fullRewards.length <= FOSSABOT_MESSAGE_LIMIT - MIN_STORY_TARGET - 1) return fullRewards;

    const compactSections = [
        sections[0],
        fitAdventureChatMessage(winnerRewards.length ? `Survivors are: ${formatEntryList(winnerRewards, 12)}.` : outcome, 520),
        recoveryBonuses.length ? fitAdventureChatMessage(`Recovery bonuses: ${formatEntryList(recoveryBonuses, 6)}.`, 260) : "",
        loot.length ? fitAdventureChatMessage(`${formatEntryList(loot, 6)}.`, 260) : "",
        statuses.length ? fitAdventureChatMessage(`${formatEntryList(statuses, 6)}.`, 260) : "",
    ].filter(Boolean);
    return compactSections.join(" ");
}

/** Produces one Fossabot-safe chat message in the legacy adventure style. */
export function formatAdventureChatResult(input: AdventureChatResultInput): string[] {
    const rewards = formatRewardsMessage(input);
    const story = cleanAdventureProse(`${input.title}. ${input.intro} ${formatResultMessage(input)}`);
    const storyBudget = Math.max(1, FOSSABOT_MESSAGE_LIMIT - rewards.length - 1);
    const fittedStory = fitAdventureChatMessage(story, storyBudget);
    return [fitAdventureChatMessage(`${fittedStory} ${rewards}`)];
}

export function joinAdventureChatMessages(messages: readonly string[]): string {
    return messages.filter(Boolean).join(" ");
}
