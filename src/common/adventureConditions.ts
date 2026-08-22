import { AdventureCheck, ModifierEntry } from "@/adventures/rpg";

export interface AdventureConditionForResolution {
    id: number;
    code: string;
    name: string;
    modifier: number;
    checkCodes: string[];
    themeCodes: string[];
}

export interface AdventureConditionEvaluation {
    conditionIdsToAdvance: number[];
    modifier?: ModifierEntry;
}

/**
 * A status affects the roll only when its check and theme match, but its duration
 * advances whenever the player completes an adventure.
 */
export function evaluateAdventureConditions(
    conditions: readonly AdventureConditionForResolution[],
    check: AdventureCheck,
    theme: string,
): AdventureConditionEvaluation {
    const applicable = conditions.find(
        condition =>
            (condition.checkCodes.length === 0 || condition.checkCodes.includes(check)) &&
            (condition.themeCodes.length === 0 || condition.themeCodes.includes(theme)),
    );

    return {
        conditionIdsToAdvance: conditions.map(condition => condition.id),
        modifier: applicable
            ? { code: applicable.code, label: applicable.name, source: "status", modifier: Math.max(-1, Math.min(1, applicable.modifier)) }
            : undefined,
    };
}
