'use client';

import { useEffect, useState } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { aiMap, localizeText, useI18n } from '@/lib/i18n';
import type { Facility, FeedbackItem, Paginated, Priority, Sentiment } from '@/lib/types';
import { usePollWhile } from '@/lib/poll';
import { modelName } from '@/components/clinical';
import { SentimentBadge } from '@/components/badges';
import { QrCode } from '@/components/QrCode';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Loading, PageHeader, Select, Spinner, cx } from '@/components/ui';

const PRIORITY_TONE: Record<Priority, 'red' | 'amber' | 'slate'> = { HIGH: 'red', MEDIUM: 'amber', LOW: 'slate' };

function Stars({ rating }: { rating: number }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" role="img" aria-label={t.feedback.stars(rating)}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? '' : 'text-slate-200'} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const [sentiment, setSentiment] = useState<Sentiment | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [page, setPage] = useState(1);
  const [origin, setOrigin] = useState('');
  const { t, locale } = useI18n();
  const tf = t.feedback;
  /** Summary in the UI language: AI translation, or a keyword-rules summary composed locally. */
  const summaryOf = (a: NonNullable<FeedbackItem['analysis']>) => {
    if (!a.engine.startsWith('GEMINI')) {
      return tf.ruleSummary(t.enums.sentiment[a.sentiment], a.topics.map((x) => (t.enums.topic[x] ?? x).toLowerCase()).join(', '));
    }
    return a.summary ? localizeText(a.summary, t, aiMap(a.i18n, locale)) : null;
  };
  useEffect(() => setOrigin(window.location.origin), []);

  const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (sentiment) qs.set('sentiment', sentiment);
  if (priority) qs.set('priority', priority);
  const { data, error, loading, reload } = useResource<Paginated<FeedbackItem>>(`/feedback?${qs}`);
  const facilities = useResource<Facility[]>('/facilities');
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = !!(sentiment || priority);
  const clear = () => {
    setSentiment('');
    setPriority('');
    setPage(1);
  };
  usePollWhile(!!data?.items.some((f) => f.analysis?.aiPending), reload);

  return (
    <>
      <PageHeader
        title={tf.title}
        subtitle={tf.subtitle}
        actions={
          <Button variant="secondary" onClick={() => void reload()}>
            <Icon name="refresh" /> {t.common.refresh}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          id="fp"
          aria-label={tf.priority}
          className="w-auto min-w-40"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as Priority | '');
            setPage(1);
          }}
        >
          <option value="">{tf.allPriorities}</option>
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map((v) => (
            <option key={v} value={v}>
              {t.enums.priorityFull[v]}
            </option>
          ))}
        </Select>
        <Select
          id="fs"
          aria-label={tf.sentiment}
          className="w-auto min-w-40"
          value={sentiment}
          onChange={(e) => {
            setSentiment(e.target.value as Sentiment | '');
            setPage(1);
          }}
        >
          <option value="">{tf.allSentiment}</option>
          {(['NEGATIVE', 'NEUTRAL', 'POSITIVE'] as const).map((v) => (
            <option key={v} value={v}>
              {t.enums.sentiment[v]}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button variant="ghost" onClick={clear}>
            {t.patients.clearFilters}
          </Button>
        )}
        {data && <p className="ml-auto text-meta tabular-nums text-slate-500">{t.common.results(data.total)}</p>}
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label={tf.loading} />
      ) : !data?.items.length ? (
        <EmptyState
          title={filtered ? t.patients.emptyFiltered : tf.empty}
          icon={filtered ? 'search' : 'qr'}
          action={
            filtered ? (
              <Button variant="secondary" size="sm" onClick={clear}>
                {t.patients.clearFilters}
              </Button>
            ) : undefined
          }
        >
          {filtered ? tf.emptyFilteredHint : tf.emptyHint}
        </EmptyState>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line-soft">
            {data.items.map((f) => {
              const a = f.analysis;
              return (
                <li key={f.id} className={cx('relative px-4 py-4 sm:px-5', a?.safetySignal && 'bg-red-50/30')}>
                  {a?.safetySignal && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-red-500" />}
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {a?.safetySignal && (
                        <Badge tone="red">
                          <Icon name="alert" className="h-3.5 w-3.5" /> {tf.safetySignal}
                        </Badge>
                      )}
                      {a && (
                        <Badge tone={PRIORITY_TONE[a.priority]} dot>
                          {t.enums.priorityFull[a.priority]}
                        </Badge>
                      )}
                      <Stars rating={f.rating} />
                      <span className="text-meta text-slate-500">{t.enums.feedbackType[f.type]}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {f.facility.name}
                      {f.ward && ` · ${f.ward}`} · {fmtDateTime(f.createdAt)}
                    </span>
                  </div>
                  {f.text ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-900">“{f.text}”</p>
                  ) : (
                    <p className="mt-2.5 text-sm italic text-slate-500">{tf.ratingOnly}</p>
                  )}
                  {a ? (
                    <div className="mt-3 border-l-2 border-line pl-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SentimentBadge sentiment={a.sentiment} />
                        <Badge>{t.enums.category[a.category] ?? a.category}</Badge>
                        {a.topics.map((tp) => (
                          <span key={tp} className="text-xs text-slate-500">
                            #{(t.enums.topic[tp] ?? tp).toLowerCase()}
                          </span>
                        ))}
                      </div>
                      {summaryOf(a) && <p className="mt-1.5 text-sm text-slate-700">{summaryOf(a)}</p>}
                      {a.warnings.map((w) => (
                        <p key={w} className="mt-1 flex gap-1.5 text-xs text-amber-800">
                          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5" /> {localizeText(w, t)}
                        </p>
                      ))}
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500">
                        {a.aiPending ? (
                          <>
                            <Spinner className="h-3 w-3" /> {tf.classifying}
                          </>
                        ) : (
                          <>
                            <Icon name={a.engine.startsWith('GEMINI') ? 'sparkle' : 'shield'} className="h-3.5 w-3.5" />
                            {tf.engine[a.engine]}
                            {a.model && ` · ${modelName(a.model)}`}
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">{tf.pending}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {data && pages > 1 && (
        <nav aria-label={t.common.pageOf(page, pages)} className="mt-4 flex items-center justify-between text-meta">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t.common.previous}</Button>
          <span className="tabular-nums text-slate-500">{t.common.pageOf(page, pages)}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t.common.next}</Button>
        </nav>
      )}

      <details className="group mt-8 rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
          <span>
            <span className="flex items-center gap-2 text-section font-semibold text-slate-900">
              <Icon name="qr" /> {tf.qrTitle}
            </span>
            <span className="mt-0.5 block text-meta text-slate-500">{tf.qrDesc}</span>
          </span>
          <Icon name="chevronDown" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex gap-3 overflow-x-auto border-t border-line-soft p-4 sm:p-5">
          {facilities.data?.map((fac) => {
            const url = `${origin}/f/${fac.publicCode}`;
            return (
              <a key={fac.id} href={url} target="_blank" rel="noopener noreferrer" className="w-44 shrink-0 rounded-[var(--radius-control)] p-3 text-center ring-1 ring-inset ring-line transition-colors hover:bg-slate-50">
                {origin && <QrCode value={url} size={140} />}
                <p className="mt-2 text-xs font-medium text-slate-800">{fac.name}</p>
                <p className="font-mono text-[11px] text-slate-500">{fac.publicCode}</p>
              </a>
            );
          })}
        </div>
      </details>
    </>
  );
}
