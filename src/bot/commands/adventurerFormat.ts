export interface AdventureBuffSummary {
    theme: string | null;
    modifier: number;
}

export interface AdventureStatusSummary {
    name: string;
    modifier: number;
    remainingAdventures: number;
}

function formatTheme(theme: string): string {
    return theme.replace(/(^|[-\s])\p{L}/gu, match => match.toUpperCase());
}

/** Shows only the strongest equipped bonus for each future adventure theme. */
export function formatAdventureBuffs(buffs: readonly AdventureBuffSummary[]): string {
    const strongestByTheme = new Map<string, number>();
    for (const buff of buffs) {
        if (!buff.theme || buff.modifier <= 0) continue;
        strongestByTheme.set(buff.theme, Math.max(strongestByTheme.get(buff.theme) ?? 0, buff.modifier));
    }

    const strongest = [...strongestByTheme]
        .map(([theme, modifier]) => ({ theme, percent: modifier * 5 }))
        .sort((left, right) => right.percent - left.percent || left.theme.localeCompare(right.theme));
    return strongest.length ? strongest.map(buff => `${formatTheme(buff.theme)} +${buff.percent}%`).join(", ") : "none";
}

/** Adventure Lite applies only one status, so character output shows only that status. */
export function formatAdventureStatus(status: AdventureStatusSummary | undefined): string | undefined {
    if (!status) return undefined;
    const percent = status.modifier * 5;
    return `${status.name} ${percent >= 0 ? "+" : ""}${percent}% (${status.remainingAdventures} adv)`;
}
