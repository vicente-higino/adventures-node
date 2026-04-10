import { emoteTracker } from "@/bot";
import { CATEGORY_EMOTES, CATEGORY_EMOTES_RECORD, Emote, EmoteCategory, EmoteName, EmoteProvider } from "./emotes-data";
import { pickRandom } from "@/utils/misc";

export class EmoteManager {
    private static readonly emoteCategoriesCache = new Map<EmoteCategory, Emote[]>();

    private static getEmotesForCategory(category: EmoteCategory): (Emote | Emote[])[] {
        if (!this.emoteCategoriesCache.has(category)) {
            return CATEGORY_EMOTES[category] || [];
        }
        return this.emoteCategoriesCache.get(category)!;
    }
    /**
     * Get a random emote from a specific category
     */
    public static getRandomEmote(category: EmoteCategory, channel?: string): (Emote | Emote[]) | null {
        const emotes = this.getEmotesForCategory(category);
        const emote = pickRandom(emotes);
        if (emote instanceof Array) {
            if (!channel) return emote;
            return emote.filter(e => emoteTracker?.channelHasEmote(channel, e.name) || e.provider == 'native')
        }
        if (!channel || emote.provider == "native") return emote;
        return emoteTracker?.channelHasEmote(channel, emote.name) ? emote : null;
    }

    /**
     * Get a random emote name from a specific category (for backward compatibility)
     */
    public static getRandomEmoteName(category: EmoteCategory): (channel?: string) => string {
        return (channel?: string) => {
            const emote = this.getRandomEmote(category, channel);
            if (emote instanceof Array) {
                return emote.map(e => e.name).join(" ");
            }
            return emote?.name ?? "";
        };
    }

    public static getEmote(name: EmoteName): Emote {
        return Emote(name);
    }

    public static getAllEmotes(): Emote[] {
        return Object.values(CATEGORY_EMOTES).flat(2);
    }

}

// Legacy exports for backward compatibility
export const DUEL_CREATE_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.DUEL_CREATE);
export const PAUSE_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.PAUSE);
export const DUEL_DENY_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.DUEL_DENY);
export const CONGRATULATIONS_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.CONGRATULATIONS);
export const CONGRATULATIONS_TRASH_FISH_DEX_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.CONGRATULATIONS_TRASH_FISH_DEX);
export const DUEL_WIN_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.DUEL_WIN);
export const FACTS_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.FACTS);
export const QUOTES_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.QUOTES);
export const SAD_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.SAD);
export const ADVENTURE_COOLDOWN_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.ADVENTURE_COOLDOWN);
export const FISH_COOLDOWN_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.FISH_COOLDOWN);
export const FISH_FINE_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.FISH_FINE);
export const MUSHY_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.MUSHY);
export const SOCKO_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.SOCKO);
export const APRIL_FOOZE_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.APRIL_FOOZE);
export const FUSLIE_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.FUSLIE);
export const FROG_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.FROG);
export const BLOBFISH_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.BLOBFISH);
export const SURGEONFISH_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.SURGEONFISH);
export const EVENT_STARTED_EMOTES = EmoteManager.getRandomEmoteName(EmoteCategory.EVENT_STARTED);
export const ADVENTURE_GAMBA_EMOTE = EmoteManager.getRandomEmoteName(EmoteCategory.ADVENTURE_START_EMOTES);

export const VALUE_EMOTES_LIST = CATEGORY_EMOTES_RECORD[EmoteCategory.VALUE];
export const ADVENTURE_ENDING_EMOTE = CATEGORY_EMOTES_RECORD[EmoteCategory.ADVENTURE_END_EMOTES];
