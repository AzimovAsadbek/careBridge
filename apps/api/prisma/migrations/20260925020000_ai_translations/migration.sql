-- Uzbek / Russian translations of AI free text (only safety-checked pairs are stored).
ALTER TABLE "RiskAssessment" ADD COLUMN "i18n" JSONB;
ALTER TABLE "FeedbackAnalysis" ADD COLUMN "i18n" JSONB;
