import { BotCommand } from "@twurple/easy-bot";
import { emoteRankCommand, emoteCountCommand, myEmoteCountCommand, myEmoteRankCommand } from "./emoteCount";
import { fishCommand } from "./fish";
import { fishCountCommand, fishCountGlobalCommand } from "./fishCount";
import { fishDexCommand, fishDexGlobalCommand } from "./fishDex";
import { fishGalleryCommand } from "./fishGallery";
import { fishOddsCommand } from "./fishOdds";
import { fishRecordsCommand } from "./fishRecords";
import { flexFishCommand } from "./flexFish";
import { refreshEmotesCommand, refreshEmotesAdminCommand } from "./refreshEmotesCommand";
import { resetRarityWeightCommand } from "./resetFishWeight";
import { setRarityWeightCommand } from "./setFishWeight";
import { silverCommand } from "./silver";
import { forceEndAdventureCommand } from "./forceEndAdventure";
import { reloadCommand } from "./reload";
import { startEventCommand } from "./startEvent";
import { giveSilverCommand } from "./giveSilver";
import { statsCommand } from "./stats";
import { leaderboardCommand } from "./leaderboard";
import { showAllEmotesCommand } from "./showAllEmotes";
import { showChannelEmotesCommand } from "./showChannelEmotes";
import { showGlobalEmotesCommand } from "./showGlobalEmotes";
import { adventureEndCommand } from "./adventureEnd";
import { adventureJoinCommand } from "./adventureJoin";
import { duelCreateCommand } from "./duelCreate";
import { duelAcceptCommand } from "./duelAccept";
import { duelCancelCommand } from "./duelCancel";

export const commands: BotCommand[] = [
    fishCommand,
    silverCommand,
    setRarityWeightCommand,
    resetRarityWeightCommand,
    fishOddsCommand,
    flexFishCommand,
    fishGalleryCommand,
    fishDexCommand,
    fishDexGlobalCommand,
    fishCountCommand,
    fishCountGlobalCommand,
    fishRecordsCommand,
    emoteRankCommand,
    emoteCountCommand,
    myEmoteCountCommand,
    myEmoteRankCommand,
    refreshEmotesCommand,
    refreshEmotesAdminCommand,
    forceEndAdventureCommand,
    reloadCommand,
    startEventCommand,
    giveSilverCommand,
    statsCommand,
    leaderboardCommand,
    showAllEmotesCommand,
    showChannelEmotesCommand,
    showGlobalEmotesCommand,
    adventureEndCommand,
    adventureJoinCommand,
    duelCreateCommand,
    duelAcceptCommand,
    duelCancelCommand,
];
