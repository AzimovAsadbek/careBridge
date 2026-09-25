'use client';

import type { AiEngine, Continuity, Observation, RiskAssessment } from '@/lib/types';
import { fmtDateTime } from '@/lib/format';
import { aiMap, localizeFactor, localizeText, useI18n } from '@/lib/i18n';
import { RiskLevel } from './badges';
import { Badge, Card, CardTitle, Icon, Spinner, Stepper, cx, type Step, type Tone } from './ui';

export function AiDisclaimer({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cx('flex gap-2 text-xs text-slate-500', className)}>
      <Icon name="shield" className="mt-0.5 h-3.5 w-3.5" />
      <span>{t.risk.disclaimer}</span>
    </p>
  );
}

const ENGINE_TONE: Record<AiEngine, Tone> = { GEMINI: 'brand', GEMINI_WITH_RULE_OVERRIDE: 'amber', FALLBACK_RULE_ENGINE: 'slate', RULE_ENGINE: 'slate' };

export function modelName(model: string | null) {
  return model ? model.replace(/^gemini-/, 'Gemini ').replace(/-/g, ' ').replace(/\bflash\b/i, 'Flash').replace(/\blite\b/i, 'Lite') : null;
}

/** Clinical decision-support panel: level → next step → evidence → provenance → safety notes. */
export function RiskCard({ assessment, action }: { assessment: RiskAssessment | undefined; action?: React.ReactNode }) {
  const { t, locale } = useI18n();
  if (!assessment) {
    return (
      <Card>
        <CardTitle action={action} description={t.risk.desc}>
          {t.risk.title}
        </CardTitle>
        <p className="text-sm text-slate-600">{t.risk.notAssessed}</p>
      </Card>
    );
  }
  const engine = { ...t.risk.engine[assessment.engine], tone: ENGINE_TONE[assessment.engine] };
  const tr = aiMap(assessment.i18n, locale);
  const ruleFactors = assessment.factors.filter((f) => f.source !== 'ai');
  const aiFactors = assessment.factors.filter((f) => f.source === 'ai');
  const tone = assessment.level === 'HIGH' ? 'border-red-200 bg-red-50/60' : assessment.level === 'MEDIUM' ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60';

  return (
    <Card>
      <CardTitle action={action} description={t.risk.desc}>
        {t.risk.title}
      </CardTitle>

      <div className="flex flex-wrap items-center gap-3">
        <RiskLevel level={assessment.level} />
        <div className="text-xs text-slate-600">
          <p>{t.risk.ruleScore(assessment.score)}</p>
          <p>{fmtDateTime(assessment.updatedAt ?? assessment.createdAt)}</p>
        </div>
      </div>

      <div className={cx('mt-4 rounded-[var(--radius-control)] border px-3 py-2.5', tone)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t.risk.nextStep}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">{localizeText(assessment.recommendedAction, t, tr)}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {assessment.aiPending ? (
          <Badge tone="blue">
            <Spinner className="h-3 w-3" /> {t.risk.reviewing}
          </Badge>
        ) : (
          <Badge tone={engine.tone}>
            {assessment.engine.startsWith('GEMINI') ? <Icon name="sparkle" className="h-3.5 w-3.5" /> : <Icon name="shield" className="h-3.5 w-3.5" />}
            {engine.label}
          </Badge>
        )}
        {!assessment.aiPending && assessment.model && assessment.engine.startsWith('GEMINI') && (
          <span className="text-slate-600">{modelName(assessment.model)}</span>
        )}
        {assessment.confidence != null && !assessment.aiPending && (
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            {t.risk.confidence}
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200" aria-hidden>
              <span className="block h-full bg-brand-600" style={{ width: `${Math.round(assessment.confidence * 100)}%` }} />
            </span>
            <span className="font-semibold tabular-nums text-slate-800">{Math.round(assessment.confidence * 100)}%</span>
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {assessment.aiPending ? t.risk.pendingNote : engine.detail}
      </p>

      {ruleFactors.length + aiFactors.length > 0 ? (
        <div className="mt-4 space-y-4">
          {ruleFactors.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{t.risk.ruleFactors}</h3>
              <ul className="divide-y divide-slate-100 rounded-[var(--radius-control)] border border-line">
                {ruleFactors.map((f) => (
                  <li key={`r-${f.code}-${f.label}`} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-slate-800">{localizeFactor(f, t)}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-700" title={t.risk.ruleWeight}>
                      +{f.weight}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aiFactors.length > 0 && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                <Icon name="sparkle" className="h-3.5 w-3.5" /> {t.risk.aiFindings}
              </h3>
              <ul className="space-y-1.5">
                {aiFactors.map((f) => (
                  <li key={`a-${f.code}`} className="flex gap-2 text-sm text-slate-800">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                    {localizeFactor(f, t, tr)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">{t.risk.noFactors}</p>
      )}

      {assessment.warnings.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">{t.risk.safetyNotes}</h3>
          <ul className="space-y-1 rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {assessment.warnings.map((w) => (
              <li key={w} className="flex gap-1.5">
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5" /> {localizeText(w, t, tr)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <AiDisclaimer className="mt-4 border-t border-line pt-3" />
    </Card>
  );
}

export function ContinuityCard({ continuity }: { continuity: Continuity }) {
  const { t } = useI18n();
  const done = continuity.steps.filter((s) => s.done).length;
  const color = continuity.score >= 80 ? 'text-emerald-700' : continuity.score >= 40 ? 'text-amber-700' : 'text-red-700';
  const bar = continuity.score >= 80 ? 'bg-emerald-600' : continuity.score >= 40 ? 'bg-amber-500' : 'bg-red-600';
  return (
    <Card>
      <CardTitle description={t.continuity.desc}>{t.continuity.title}</CardTitle>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cx('text-3xl font-semibold tabular-nums', color)}>{continuity.score}%</span>
        {continuity.onTime !== null && <Badge tone={continuity.onTime ? 'green' : 'amber'}>{continuity.onTime ? t.continuity.onTime : t.continuity.late}</Badge>}
      </div>
      <p className="text-sm text-slate-600">{t.patient.handoffs(done, continuity.steps.length)}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={t.continuity.title} aria-valuenow={continuity.score} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('h-full rounded-full transition-all', bar)} style={{ width: `${continuity.score}%` }} />
      </div>
      <ul className="mt-4 space-y-2">
        {continuity.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span
              className={cx('flex h-5 w-5 items-center justify-center rounded-full', s.done ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-400')}
              aria-hidden
            >
              {s.done ? <Icon name="check" className="h-3 w-3" /> : null}
            </span>
            <span className={s.done ? 'text-slate-900' : 'text-slate-500'}>{t.continuity.steps[s.key] ?? s.label}</span>
            <span className="sr-only">{s.done ? t.continuity.done : t.continuity.notDone}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">{t.continuity.note}</p>
    </Card>
  );
}

/** Hospital → home journey as a stepper. */
export function CareJourney({
  steps,
  className,
}: {
  steps: { label: string; at?: string | null; done: boolean; late?: boolean }[];
  className?: string;
}) {
  const { t } = useI18n();
  const firstOpen = steps.findIndex((s) => !s.done);
  const mapped: Step[] = steps.map((s, i) => ({
    label: s.label,
    detail: s.at ? fmtDateTime(s.at) : s.late ? t.enums.referralStatus.OVERDUE : undefined,
    state: s.done ? 'done' : i === firstOpen ? (s.late ? 'late' : 'current') : 'upcoming',
  }));
  return (
    <div className={className}>
      <Stepper steps={mapped} label={t.patient.journey} />
    </div>
  );
}

function vitalFlag(kind: 'bp' | 'temp' | 'spo2', o: Observation) {
  if (kind === 'bp') return (o.systolic ?? 0) >= 160 || (o.systolic != null && o.systolic < 90);
  if (kind === 'temp') return (o.temperature ?? 0) >= 38;
  return o.spo2 != null && o.spo2 < 94;
}

function Flagged({ on, children }: { on: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  return on ? (
    <span className="font-semibold text-red-700">
      {children}
      <span aria-hidden> ↑</span>
      <span className="sr-only"> ({t.vitals.abnormal})</span>
    </span>
  ) : (
    <>{children}</>
  );
}

/** Observations: cards in narrow containers, a table when the container is ≥ 42rem. Abnormal values are marked with text, not colour alone. */
export function VitalsTable({ observations, pendingIds }: { observations: Observation[]; pendingIds?: Set<string> }) {
  const { t } = useI18n();
  if (!observations.length) return <p className="text-sm text-slate-600">{t.vitals.none}</p>;
  const symptom = (x: string) => t.enums.symptom[x] ?? x;
  const tag = (o: Observation) =>
    pendingIds?.has(o.id) ? (
      <Badge tone="amber">
        <Icon name="device" className="h-3 w-3" /> {t.vitals.onDevice}
      </Badge>
    ) : o.syncedFromOffline ? (
      <Badge tone="blue">
        <Icon name="cloudCheck" className="h-3 w-3" /> {t.vitals.offlineSynced}
      </Badge>
    ) : null;
  const condition = (o: Observation) => (
    <>
      {o.generalCondition && <span className="font-medium">{t.enums.condition[o.generalCondition]}</span>}
      {o.symptoms.length > 0 && <span className="text-slate-600">{o.generalCondition ? ' · ' : ''}{o.symptoms.map(symptom).join(', ')}</span>}
      {o.notes && <p className="text-xs text-slate-600">{o.notes}</p>}
    </>
  );

  // Container query: the table appears only when the *container* is wide enough (not the screen).
  return (
    <div className="@container">
      <ul className="space-y-3 @2xl:hidden">
        {observations.map((o) => (
          <li key={o.id} className="rounded-[var(--radius-control)] border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900">{fmtDateTime(o.recordedAt)}</span>
              {tag(o)}
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[
                [t.vitals.bp, <Flagged key="bp" on={vitalFlag('bp', o)}>{o.systolic ?? '—'}/{o.diastolic ?? '—'}</Flagged>],
                [t.vitals.pulse, o.pulse ?? '—'],
                [t.vitals.tempShort, <Flagged key="t" on={vitalFlag('temp', o)}>{o.temperature ?? '—'}</Flagged>],
                [t.vitals.spo2, <Flagged key="s" on={vitalFlag('spo2', o)}>{o.spo2 != null ? `${o.spo2}%` : '—'}</Flagged>],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded bg-slate-50 py-1.5">
                  <dt className="text-[11px] text-slate-500">{k}</dt>
                  <dd className="text-sm tabular-nums text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 text-sm text-slate-800">{condition(o)}</div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto @2xl:block">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">{t.vitals.caption}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-slate-600">
              <th scope="col" className="py-2 pr-3 font-medium">{t.vitals.recorded}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t.vitals.bp}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t.vitals.pulse}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t.vitals.temp}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t.vitals.spo2}</th>
              <th scope="col" className="min-w-56 px-3 py-2 font-medium">{t.vitals.condition}</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="whitespace-nowrap py-2.5 pr-3">
                  <span className="text-slate-900">{fmtDateTime(o.recordedAt)}</span>
                  <div className="mt-1">{tag(o)}</div>
                </td>
                <td className="px-3 py-2.5 tabular-nums"><Flagged on={vitalFlag('bp', o)}>{o.systolic ?? '—'}/{o.diastolic ?? '—'}</Flagged></td>
                <td className="px-3 py-2.5 tabular-nums">{o.pulse ?? '—'}</td>
                <td className="px-3 py-2.5 tabular-nums"><Flagged on={vitalFlag('temp', o)}>{o.temperature ?? '—'}</Flagged></td>
                <td className="px-3 py-2.5 tabular-nums"><Flagged on={vitalFlag('spo2', o)}>{o.spo2 != null ? `${o.spo2}%` : '—'}</Flagged></td>
                <td className="min-w-56 px-3 py-2.5 text-slate-800">{condition(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
