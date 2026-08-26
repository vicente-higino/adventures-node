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
    lootName?: string;
    lootEquipped?: boolean;
    lootSilverBonus?: number;
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

function formatLootDetail(player: AdventureChatPlayerResult): string | undefined {
    if (!player.lootName) return undefined;
    return player.lootEquipped ? `found and equipped ${player.lootName}` : `found ${player.lootName}`;
}

function formatStatusDetail(player: AdventureChatPlayerResult): string | undefined {
    return player.statusName ? `now ${player.statusName}` : undefined;
}

function totalDisplayedSilver(player: AdventureChatPlayerResult): number {
    return player.profit + player.streakBonus + (player.lootSilverBonus ?? 0);
}

function formatRewardsMessage(input: AdventureChatResultInput): string {
    const winners = input.players
        .filter(player => player.success)
        .sort((left, right) => totalDisplayedSilver(right) - totalDisplayedSilver(left));
    const winnerRewards = winners.map(player => {
        const details = [
            `+${formatSilver(player.profit)} silver`,
            player.streakBonus > 0 ? `+${formatSilver(player.streakBonus)} silver bonus` : undefined,
            player.streakBonus > 0 ? `${player.streak}-win streak` : undefined,
            player.lootSilverBonus ? `+${formatSilver(player.lootSilverBonus)} silver loot bonus` : undefined,
            player.criticalCode === "critical-success" ? "critical success" : undefined,
            formatLootDetail(player),
            formatStatusDetail(player),
        ].filter(Boolean);
        return `@${player.displayName} (${details.join(", ")})`;
    });
    const recoveryBonuses = input.players
        .filter(player => !player.success && player.streakBonus > 0)
        .sort((left, right) => right.streakBonus - left.streakBonus)
        .map(player => {
            const details = [
                `+${formatSilver(player.streakBonus)} silver bonus`,
                `${player.streak}-lose streak`,
                player.criticalCode === "critical-failure" ? "critical failure" : undefined,
                formatLootDetail(player),
                formatStatusDetail(player),
            ].filter(Boolean);
            return `@${player.displayName} (${details.join(", ")})`;
        });
    const otherUpdates = input.players
        .filter(player => !player.success && player.streakBonus === 0 && (player.lootName || player.statusName || player.criticalCode))
        .map(player => {
            const details = [
                player.criticalCode === "critical-failure" ? "critical failure" : undefined,
                formatLootDetail(player),
                formatStatusDetail(player),
            ].filter(Boolean);
            return `@${player.displayName} (${details.join(", ")})`;
        });
    const outcome = winnerRewards.length
        ? `Survivors are: ${formatEntryList(winnerRewards, winnerRewards.length)}.`
        : "No survivors. All players lost their silver.";
    const sections = [
        `The adventure ended with a ${input.payoutRate.toFixed(2)}x payout rate!`,
        outcome,
        recoveryBonuses.length ? `${formatEntryList(recoveryBonuses, recoveryBonuses.length)}.` : "",
        otherUpdates.length ? `${formatEntryList(otherUpdates, otherUpdates.length)}.` : "",
    ].filter(Boolean);
    const fullRewards = sections.join(" ");
    if (fullRewards.length <= FOSSABOT_MESSAGE_LIMIT - MIN_STORY_TARGET - 1) return fullRewards;

    const compactSections = [
        sections[0],
        fitAdventureChatMessage(winnerRewards.length ? `Survivors are: ${formatEntryList(winnerRewards, 12)}.` : outcome, 520),
        recoveryBonuses.length ? fitAdventureChatMessage(`${formatEntryList(recoveryBonuses, 6)}.`, 260) : "",
        otherUpdates.length ? fitAdventureChatMessage(`${formatEntryList(otherUpdates, 6)}.`, 260) : "",
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
