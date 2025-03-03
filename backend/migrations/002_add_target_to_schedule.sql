-- Add target_id column to schedule table
ALTER TABLE "schedule" ADD COLUMN "target_id" uuid;

-- Add foreign key constraint
ALTER TABLE "schedule" ADD CONSTRAINT "FK_schedule_target" FOREIGN KEY ("target_id") REFERENCES "target"("id");

-- Update existing schedules to use a default target (if any exist)
DO $$
DECLARE
  default_target_id uuid;
BEGIN
  -- Get the first target id (if any)
  SELECT id INTO default_target_id FROM "target" LIMIT 1;
  
  -- If there's at least one target, update existing schedules
  IF default_target_id IS NOT NULL THEN
    UPDATE "schedule" SET "target_id" = default_target_id WHERE "target_id" IS NULL;
  END IF;
END $$;

-- Make target_id not nullable after setting default values
ALTER TABLE "schedule" ALTER COLUMN "target_id" SET NOT NULL; 