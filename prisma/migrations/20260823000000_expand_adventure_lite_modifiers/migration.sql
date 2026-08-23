-- Adventure Lite derives item strength from rarity and permits a temporary
-- Inspired status. Expand the original RPG bounds without weakening the
-- negative side or the payout-aware resolution rules enforced by the app.

ALTER TABLE "AdventureItem"
DROP CONSTRAINT IF EXISTS "AdventureItem_modifier_bounded_check",
ADD CONSTRAINT "AdventureItem_modifier_bounded_check" CHECK ("modifier" BETWEEN -1 AND 4);

-- Keep +1 valid for statuses created by the previous rules version while
-- allowing the new +2 Inspired status.
ALTER TABLE "AdventureProfileCondition"
DROP CONSTRAINT IF EXISTS "AdventureProfileCondition_modifier_check",
ADD CONSTRAINT "AdventureProfileCondition_modifier_check" CHECK ("modifier" IN (-1, 1, 2));

ALTER TABLE "AdventurePlayerResult"
DROP CONSTRAINT IF EXISTS "AdventurePlayerResult_effective_modifier_check",
DROP CONSTRAINT IF EXISTS "AdventurePlayerResult_chance_check",
ADD CONSTRAINT "AdventurePlayerResult_effective_modifier_check" CHECK ("effectiveModifier" BETWEEN -4 AND 5),
ADD CONSTRAINT "AdventurePlayerResult_chance_check" CHECK ("chancePercent" BETWEEN 30 AND 75 AND MOD("chancePercent", 5) = 0);
