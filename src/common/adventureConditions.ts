import { ModifierEntry } from "@/adventures/rpg";

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
 * Adventure Lite permits one temporary status. It applies to the next adventure
 * and then advances, regardless of that adventure's internal theme/check data.
 */
export function evaluateAdventureConditions(conditions: readonly AdventureConditionForResolution[]): AdventureConditionEvaluation {
    const applicable = conditions[0];

    return {
        conditionIdsToAdvance: conditions.map(condition => condition.id),
        modifier: applicable
            ? { code: applicable.code, label: applicable.name, source: "status", modifier: Math.max(-1, Math.min(2, applicable.modifier)) }
            : undefined,
    };
}
