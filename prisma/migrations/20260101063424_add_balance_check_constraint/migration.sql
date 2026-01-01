-- This is an empty migration.

ALTER TABLE "Balance"
ADD CONSTRAINT balance_value_non_negative
CHECK (value >= 0);