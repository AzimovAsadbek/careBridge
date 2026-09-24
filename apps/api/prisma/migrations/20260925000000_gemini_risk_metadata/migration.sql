-- Engine taxonomy for AI results. Values are renamed (not dropped) so existing rows keep their meaning.
ALTER TYPE "AiEngine" RENAME VALUE 'RULES' TO 'RULE_ENGINE';
ALTER TYPE "AiEngine" RENAME VALUE 'LLM' TO 'GEMINI';
ALTER TYPE "AiEngine" ADD VALUE 'GEMINI_WITH_RULE_OVERRIDE';
ALTER TYPE "AiEngine" ADD VALUE 'FALLBACK_RULE_ENGINE';

-- Risk assessment AI metadata.
ALTER TABLE "RiskAssessment"
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "aiPending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "RiskAssessment_aiPending_idx" ON "RiskAssessment"("aiPending");
