-- Feedback intelligence AI metadata.
ALTER TABLE "FeedbackAnalysis"
  ADD COLUMN "safetySignal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "aiPending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "FeedbackAnalysis_aiPending_idx" ON "FeedbackAnalysis"("aiPending");

-- Existing rows: HIGH-priority safety categories carry a safety signal.
UPDATE "FeedbackAnalysis" SET "safetySignal" = true WHERE "category" IN ('corruption', 'clinical_safety');
