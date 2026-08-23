-- Multiplier tickets can raise payouts as high as 5x. Their payout-aware
-- success ceilings range from 50% at 2x down to 20% at 5x.
ALTER TABLE "AdventurePlayerResult"
DROP CONSTRAINT IF EXISTS "AdventurePlayerResult_effective_modifier_check",
DROP CONSTRAINT IF EXISTS "AdventurePlayerResult_chance_check",
ADD CONSTRAINT "AdventurePlayerResult_effective_modifier_check" CHECK ("effectiveModifier" BETWEEN -6 AND 5),
ADD CONSTRAINT "AdventurePlayerResult_chance_check" CHECK ("chancePercent" BETWEEN 20 AND 75 AND MOD("chancePercent", 5) = 0);
