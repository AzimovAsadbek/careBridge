import type { AiEngine, Continuity, Observation, RiskAssessment } from '@/lib/types';
import { fmtDateTime, humanize } from '@/lib/format';
import { RiskBadge } from './badges';
import { Badge, Card, CardTitle, Spinner, cx, type Tone } from './ui';

export function AiDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cx('text-xs text-slate-500', className)}>
      AI-assisted risk prioritization (Gemini + deterministic safety rules) — decision support, not a diagnosis. AI can raise but
      never lower a rule-based risk. The responsible clinician makes the final decision.
    </p>
  );
}

const ENGINE: Record<AiEngine, { label: string; tone: Tone }> = {
  GEMINI: { label: 'Gemini AI · checked by safety rules', tone: 'brand' },
  GEMINI_WITH_RULE_OVERRIDE: { label: 'Safety rules overrode Gemini', tone: 'amber' },
  FALLBACK_RULE_ENGINE: { label: 'Rule engine · AI unavailable', tone: 'slate' },
  RULE_ENGINE: { label: 'Rule engine', tone: 'slate' },
};

export function modelName(model: string | null) {
  return model ? model.replace(/^gemini-/, 'Gemini ').replace(/-/g, ' ') : null;
}

export function RiskCard({ assessment, action }: { assessment: RiskAssessment | undefined; action?: React.ReactNode }) {
  const engine = assessment && ENGINE[assessment.engine];
  const ruleFactors = assessment?.factors.filter((f) => f.source !== 'ai') ?? [];
  const aiFactors = assessment?.factors.filter((f) => f.source === 'ai') ?? [];
  return (
    <Card>
      <CardTitle action={action}>AI risk prioritization</CardTitle>
      {!assessment ? (
        <p className="text-sm text-slate-500">No assessment yet. Risk is assessed automatically after each recorded observation.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={assessment.level} />
            {assessment.aiPending ? (
              <Badge tone="blue">
                <Spinner className="h-3 w-3" /> Gemini is reviewing…
              </Badge>
            ) : (
              engine && <Badge tone={engine.tone}>{engine.label}</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {fmtDateTime(assessment.updatedAt ?? assessment.createdAt)} · rule score {assessment.score}
            {assessment.confidence != null && ` · AI confidence ${Math.round(assessment.confidence * 100)}%`}
            {assessment.model && !assessment.aiPending && assessment.engine !== 'RULE_ENGINE' && ` · ${modelName(assessment.model)}`}
          </p>
          {assessment.aiPending && (
            <p className="text-xs text-slate-500">Showing the rule-based result until the AI review completes.</p>
          )}
          {ruleFactors.length + aiFactors.length > 0 ? (
            <ul className="space-y-1.5">
              {ruleFactors.map((f) => (
                <li key={`r-${f.code}-${f.label}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-800">{f.label}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400">+{f.weight}</span>
                </li>
              ))}
              {aiFactors.map((f) => (
                <li key={`a-${f.code}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-800">{f.label}</span>
                  <Badge tone="brand" className="shrink-0">AI</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No risk factors detected in the latest data.</p>
          )}
          <div className={cx('rounded-lg px-3 py-2 text-sm font-medium', assessment.level === 'HIGH' ? 'bg-red-50 text-red-800' : assessment.level === 'MEDIUM' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800')}>
            Suggested next step: {assessment.recommendedAction}
          </div>
          {assessment.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {assessment.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <AiDisclaimer />
        </div>
      )}
    </Card>
  );
}

export function ContinuityCard({ continuity }: { continuity: Continuity }) {
  const color = continuity.score >= 80 ? 'text-emerald-600' : continuity.score >= 40 ? 'text-amber-600' : 'text-red-600';
  const bar = continuity.score >= 80 ? 'bg-emerald-500' : continuity.score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <Card>
      <CardTitle>Care Continuity Score</CardTitle>
      <div className="flex items-end gap-2">
        <span className={cx('text-3xl font-bold tabular-nums', color)}>{continuity.score}%</span>
        {continuity.onTime !== null && (
          <Badge tone={continuity.onTime ? 'green' : 'amber'} className="mb-1">
            {continuity.onTime ? 'completed on time' : 'completed late'}
          </Badge>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={continuity.score} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('h-full rounded-full transition-all', bar)} style={{ width: `${continuity.score}%` }} />
      </div>
      <ol className="mt-4 space-y-2">
        {continuity.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold', s.done ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-transparent')} aria-hidden>
              ✓
            </span>
            <span className={s.done ? 'text-slate-800' : 'text-slate-400'}>{s.label}</span>
            <span className="sr-only">{s.done ? 'done' : 'not done'}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-400">Process metric of hand-offs completed — not a clinical score.</p>
    </Card>
  );
}

export function VitalsTable({ observations, pendingIds }: { observations: Observation[]; pendingIds?: Set<string> }) {
  if (!observations.length) return <p className="text-sm text-slate-500">No observations recorded yet.</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-medium sm:px-2">Recorded</th>
            <th className="px-2 py-2 font-medium">BP</th>
            <th className="px-2 py-2 font-medium">Pulse</th>
            <th className="px-2 py-2 font-medium">Temp</th>
            <th className="px-2 py-2 font-medium">SpO₂</th>
            <th className="px-2 py-2 font-medium">Condition / symptoms</th>
          </tr>
        </thead>
        <tbody>
          {observations.map((o) => {
            const pending = pendingIds?.has(o.id);
            return (
              <tr key={o.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2 sm:px-2">
                  {fmtDateTime(o.recordedAt)}
                  <div className="mt-0.5 flex gap-1">
                    {pending && <Badge tone="amber">on device · not synced</Badge>}
                    {o.syncedFromOffline && !pending && <Badge tone="blue">captured offline</Badge>}
                  </div>
                </td>
                <td className={cx('px-2 py-2 tabular-nums', (o.systolic ?? 0) >= 160 && 'font-semibold text-red-600')}>
                  {o.systolic ?? '—'}/{o.diastolic ?? '—'}
                </td>
                <td className="px-2 py-2 tabular-nums">{o.pulse ?? '—'}</td>
                <td className={cx('px-2 py-2 tabular-nums', (o.temperature ?? 0) >= 38 && 'font-semibold text-red-600')}>{o.temperature ?? '—'}</td>
                <td className={cx('px-2 py-2 tabular-nums', o.spo2 != null && o.spo2 < 94 && 'font-semibold text-red-600')}>{o.spo2 != null ? `${o.spo2}%` : '—'}</td>
                <td className="px-2 py-2 text-slate-700">
                  {o.generalCondition && <span className="font-medium">{humanize(o.generalCondition.toLowerCase())}</span>}
                  {o.symptoms.length > 0 && <span className="text-slate-500"> · {o.symptoms.join(', ')}</span>}
                  {o.notes && <p className="text-xs text-slate-500">{o.notes}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
