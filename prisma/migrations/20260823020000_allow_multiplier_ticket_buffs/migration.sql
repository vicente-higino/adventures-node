-- Multiplier adventures allow up to 15 percentage points of loot/status buffs
-- above their payout-balanced starting odds.
ALTER TABLE "AdventurePlayerResult"
DROP CONSTRAINT IF EXISTS "AdventurePlayerResult_effective_modifier_check",
DROP CONSTRAINT IF EXISTS "AdventurePlayerResult_chance_check",
ADD CONSTRAINT "AdventurePlayerResult_effective_modifier_check" CHECK ("effectiveModifier" BETWEEN -7 AND 5),
ADD CONSTRAINT "AdventurePlayerResult_chance_check" CHECK ("chancePercent" BETWEEN 15 AND 75 AND MOD("chancePercent", 5) = 0);
