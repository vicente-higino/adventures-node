ALTER TABLE "AdventureInventoryItem"
DROP CONSTRAINT "AdventureInventoryItem_equipped_quantity_check";

DROP INDEX "AdventureInventoryItem_profileId_equippedSlot_key";

ALTER TABLE "AdventureInventoryItem"
DROP COLUMN "equippedSlot";

UPDATE "AdventureItem"
SET "config" = "config" - 'slot'
WHERE "config" ? 'slot';
