'use client';

import type { AiEngine, Continuity, Observation, RiskAssessment } from '@/lib/types';
import { fmtDateTime } from '@/lib/format';
import { aiMap, localizeFactor, localizeText, useI18n } from '@/lib/i18n';
import { RiskLevel } from './badges';
import { Badge, Card, CardTitle, Icon, Overline, Spinner, StepMarker, Stepper, cx, type Step, type Tone } from './ui';

export function AiDisclaimer({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cx('flex gap-2 text-xs text-slate-500', className)}>
      <Icon name="shield" className="mt-0.5 h-3.5 w-3.5" />
      <span>{t.risk.disclaimer}</span>
    </p>
  );
}

const ENGINE_TONE: Record<AiEngine, Tone> = { GEMINI: 'slate', GEMINI_WITH_RULE_OVERRIDE: 'amber', FALLBACK_RULE_ENGINE: 'slate', RULE_ENGINE: 'slate' };

export function modelName(model: string | null) {
  return model ? model.replace(/^gemini-/, 'Gemini ').replace(/-/g, ' ').replace(/\bflash\b/i, 'Flash').replace(/\blite\b/i, 'Lite') : null;
}

const RISK_ACCENT = { HIGH: 'border-t-red-500', MEDIUM: 'border-t-amber-400', LOW: 'border-t-emerald-500' } as const;
const ACTION_RULE = { HIGH: 'border-red-500', MEDIUM: 'border-amber-400', LOW: 'border-emerald-500' } as const;

/**
 * Clinical decision-support panel, read top to bottom:
 * risk level → why → recommended action → evidence → source (AI vs rules) → timestamp.
 */
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
  const usesAi = assessment.engine === 'GEMINI' || assessment.engine === 'GEMINI_WITH_RULE_OVERRIDE';
  const tr = aiMap(assessment.i18n, locale);
  const ruleFactors = [...assessment.factors.filter((f) => f.source !== 'ai')].sort((x, y) => y.weight - x.weight);
  const aiFactors = assessment.factors.filter((f) => f.source === 'ai');
  const why = [...ruleFactors.slice(0, 3).map((f) => localizeFactor(f, t)), ...aiFactors.slice(0, ruleFactors.length ? 1 : 3).map((f) => localizeFactor(f, t, tr))];
  const evidenceCount = ruleFactors.length + aiFactors.length;

  return (
    <Card padded={false} className={cx('border-t-[3px]', RISK_ACCENT[assessment.level])}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-section font-semibold text-slate-900">{t.risk.title}</h2>
            <p className="mt-0.5 text-meta text-slate-500">{t.risk.desc}</p>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>

        {/* 1 · Risk */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <RiskLevel level={assessment.level} />
          <span className="text-meta tabular-nums text-slate-500">{t.risk.ruleScore(assessment.score)}</span>
        </div>

        {/* 2 · Why */}
        {why.length > 0 ? (
          <div className="mt-4">
            <Overline>{t.risk.why}</Overline>
            <ul className="mt-1.5 space-y-1">
              {why.map((w) => (
                <li key={w} className="flex gap-2 text-sm text-slate-800">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">{t.risk.noFactors}</p>
        )}

        {/* 3 · Recommended action */}
        <div className={cx('mt-4 border-l-[3px] py-0.5 pl-3', ACTION_RULE[assessment.level])}>
          <Overline>{t.risk.nextStep}</Overline>
          <p className="mt-1 text-sm font-medium text-slate-900">{localizeText(assessment.recommendedAction, t, tr)}</p>
        </div>

        {assessment.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-[var(--radius-control)] bg-amber-50 px-3 py-2 text-xs text-amber-950" aria-label={t.risk.safetyNotes}>
            {assessment.warnings.map((w) => (
              <li key={w} className="flex gap-1.5">
                <Icon name="alert" className="mt-px h-3.5 w-3.5 text-amber-700" /> {localizeText(w, t, tr)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4 · Evidence */}
      {evidenceCount > 0 && (
        <details className="group border-t border-line-soft">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-5 [&::-webkit-details-marker]:hidden">
            {t.risk.evidence(evidenceCount)}
            <Icon name="chevronDown" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 px-4 pb-4 sm:px-5">
            {ruleFactors.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon name="shield" className="h-3.5 w-3.5" /> {t.risk.ruleFactors}
                </p>
                <ul className="divide-y divide-line-soft">
                  {ruleFactors.map((f) => (
                    <li key={`r-${f.code}-${f.label}`} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                      <span className="text-slate-800">{localizeFactor(f, t)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500" title={t.risk.ruleWeight}>
                        +{f.weight}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiFactors.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon name="sparkle" className="h-3.5 w-3.5" /> {t.risk.aiFindings}
                </p>
                <ul className="divide-y divide-line-soft">
                  {aiFactors.map((f) => (
                    <li key={`a-${f.code}-${f.label}`} className="py-1.5 text-sm text-slate-800">
                      {localizeFactor(f, t, tr)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* 5 · Source · 6 · Timestamp */}
      <div className="space-y-2 rounded-b-[var(--radius-card)] border-t border-line-soft bg-slate-50/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
          <span className="text-slate-500">{t.risk.source}</span>
          {assessment.aiPending ? (
            <Badge tone="blue">
              <Spinner className="h-3 w-3" /> {t.risk.reviewing}
            </Badge>
          ) : (
            <Badge tone={engine.tone}>
              <Icon name={usesAi ? 'sparkle' : 'shield'} className="h-3.5 w-3.5" />
              {engine.label}
            </Badge>
          )}
          {!assessment.aiPending && usesAi && assessment.model && <span>{modelName(assessment.model)}</span>}
          {assessment.confidence != null && !assessment.aiPending && (
            <span className="inline-flex items-center gap-1.5">
              {t.risk.confidence}
              <span className="h-1 w-10 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                <span className="block h-full bg-slate-500" style={{ width: `${Math.round(assessment.confidence * 100)}%` }} />
              </span>
              <span className="tabular-nums text-slate-800">{Math.round(assessment.confidence * 100)}%</span>
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {assessment.aiPending ? t.risk.pendingNote : engine.detail} · {t.risk.updated(fmtDateTime(assessment.updatedAt ?? assessment.createdAt))}
        </p>
        <AiDisclaimer />
      </div>
    </Card>
  );
}

export function ContinuityCard({ continuity }: { continuity: Continuity }) {
  const { t } = useI18n();
  const done = continuity.steps.filter((s) => s.done).length;
  const color = continuity.score >= 80 ? 'text-emerald-700' : continuity.score >= 40 ? 'text-amber-700' : 'text-red-700';
  const bar = continuity.score >= 80 ? 'bg-emerald-500' : continuity.score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <Card>
      <CardTitle description={t.continuity.desc}>{t.continuity.title}</CardTitle>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cx('text-3xl font-semibold tabular-nums', color)}>{continuity.score}%</span>
        {continuity.onTime !== null && <Badge tone={continuity.onTime ? 'green' : 'amber'}>{continuity.onTime ? t.continuity.onTime : t.continuity.late}</Badge>}
      </div>
      <p className="text-sm text-slate-600">{t.patient.handoffs(done, continuity.steps.length)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={t.continuity.title} aria-valuenow={continuity.score} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('h-full rounded-full', bar)} style={{ width: `${continuity.score}%` }} />
      </div>
    </Card>
  );
}

type JourneyStep = { label: string; at?: string | null; done: boolean; late?: boolean };

/**
 * Hospital → home journey. Wide containers: a compact horizontal track. Narrow containers
 * (phones, tablet split view): a segmented progress bar + the current step, with the full list
 * one tap away — so the journey never pushes the clinical content below the fold.
 */
export function CareJourney({ steps, className }: { steps: JourneyStep[]; className?: string }) {
  const { t } = useI18n();
  const firstOpen = steps.findIndex((s) => !s.done);
  const mapped: Step[] = steps.map((s, i) => ({
    label: s.label,
    detail: s.at ? fmtDateTime(s.at) : s.late ? t.enums.referralStatus.OVERDUE : undefined,
    state: s.done ? 'done' : i === firstOpen ? (s.late ? 'late' : 'current') : 'upcoming',
  }));
  const current = firstOpen === -1 ? null : mapped[firstOpen];
  const doneCount = steps.filter((s) => s.done).length;
  // Short journeys fit a horizontal track in less width.
  const W = steps.length > 5 ? { narrow: '@3xl:hidden', wide: 'hidden @3xl:flex' } : { narrow: '@xl:hidden', wide: 'hidden @xl:flex' };

  return (
    <div className={cx('@container', className)}>
      {/* Narrow */}
      <div className={W.narrow}>
        <div className="flex gap-1" aria-hidden>
          {mapped.map((s) => (
            <span
              key={s.label}
              className={cx('h-1.5 flex-1 rounded-full', s.state === 'done' ? 'bg-emerald-500' : s.state === 'late' ? 'bg-red-500' : s.state === 'current' ? 'bg-brand-600' : 'bg-slate-200')}
            />
          ))}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{current ? `${t.patient.stepOf(firstOpen + 1, steps.length)} · ${t.stepper[current.state]}` : t.patient.handoffs(doneCount, steps.length)}</p>
            <p className={cx('mt-0.5 text-sm font-semibold', current?.state === 'late' ? 'text-red-700' : 'text-slate-900')}>
              {current ? current.label : t.patient.journeyComplete}
            </p>
            {current?.detail && <p className="text-xs font-medium text-red-700">{current.detail}</p>}
          </div>
        </div>
        <details className="group mt-2">
          <summary className="-mx-1 inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md px-1 text-meta font-medium text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
            {t.patient.showAllSteps}
            <Icon name="chevronDown" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2">
            <Stepper steps={mapped} label={t.patient.journey} />
          </div>
        </details>
      </div>

      {/* Wide */}
      <ol aria-label={t.patient.journey} className={W.wide}>
        {mapped.map((s, i) => (
          <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className="relative min-w-0 flex-1 pr-2">
            {i < mapped.length - 1 && (
              <span aria-hidden className={cx('absolute left-7 right-1 top-[11px] h-0.5 rounded-full', s.state === 'done' ? 'bg-emerald-500' : 'bg-slate-200')} />
            )}
            <StepMarker state={s.state} index={i} />
            <p
              className={cx(
                'mt-2 hyphens-auto break-words text-[13px] leading-snug',
                s.state === 'current' || s.state === 'late' ? 'font-semibold text-slate-900' : s.state === 'done' ? 'text-slate-700' : 'text-slate-400',
              )}
            >
              {s.label}
              <span className="sr-only"> — {t.stepper[s.state]}</span>
            </p>
            {s.detail && <p className={cx('mt-0.5 text-xs', s.state === 'late' ? 'font-medium text-red-700' : 'text-slate-500')}>{s.detail}</p>}
          </li>
        ))}
      </ol>
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
    <span className="font-medium text-red-700">
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
      <ul className="-my-3 divide-y divide-line-soft @2xl:hidden">
        {observations.map((o) => (
          <li key={o.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900">{fmtDateTime(o.recordedAt)}</span>
              {tag(o)}
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2">
              {[
                [t.vitals.bp, <Flagged key="bp" on={vitalFlag('bp', o)}>{o.systolic ?? '—'}/{o.diastolic ?? '—'}</Flagged>],
                [t.vitals.pulse, o.pulse ?? '—'],
                [t.vitals.tempShort, <Flagged key="t" on={vitalFlag('temp', o)}>{o.temperature ?? '—'}</Flagged>],
                [t.vitals.spo2, <Flagged key="s" on={vitalFlag('spo2', o)}>{o.spo2 != null ? `${o.spo2}%` : '—'}</Flagged>],
              ].map(([k, v]) => (
                <div key={String(k)} className="min-w-0">
                  <dt className="truncate text-[11px] text-slate-500">{k}</dt>
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
            <tr className="border-b border-line text-xs text-slate-500">
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
              <tr key={o.id} className="border-b border-line-soft align-top transition-colors last:border-0 hover:bg-slate-50/70">
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
