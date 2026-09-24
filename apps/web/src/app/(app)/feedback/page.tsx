'use client';

import { useEffect, useState } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { fmtDateTime, humanize } from '@/lib/format';
import type { Facility, FeedbackItem, Paginated, Priority, Sentiment } from '@/lib/types';
import { PriorityBadge, SentimentBadge } from '@/components/badges';
import { QrCode } from '@/components/QrCode';
import { Badge, Button, Card, CardTitle, EmptyState, ErrorState, Loading, PageHeader, Select } from '@/components/ui';

export default function FeedbackPage() {
  const [sentiment, setSentiment] = useState<Sentiment | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [page, setPage] = useState(1);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (sentiment) qs.set('sentiment', sentiment);
  if (priority) qs.set('priority', priority);
  const { data, error, loading, reload } = useResource<Paginated<FeedbackItem>>(`/feedback?${qs}`);
  const facilities = useResource<Facility[]>('/facilities');
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Patient voice" subtitle="Anonymous feedback collected via QR codes, classified by AI feedback intelligence." />

      <Card className="mb-4">
        <CardTitle>QR codes for wards and facilities</CardTitle>
        <p className="mb-3 text-sm text-slate-600">Print and place in wards. The link contains only a public facility code — no patient or internal data.</p>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {facilities.data?.map((f) => {
            const url = `${origin}/f/${f.publicCode}`;
            return (
              <a key={f.id} href={url} target="_blank" rel="noopener noreferrer" className="w-44 shrink-0 rounded-lg border border-slate-200 p-3 text-center hover:border-brand-200">
                {origin && <QrCode value={url} size={140} />}
                <p className="mt-2 text-xs font-semibold text-slate-800">{f.name}</p>
                <p className="font-mono text-[11px] text-slate-500">{f.publicCode}</p>
              </a>
            );
          })}
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-auto" value={sentiment} onChange={(e) => { setSentiment(e.target.value as Sentiment | ''); setPage(1); }} aria-label="Filter by sentiment">
          <option value="">All sentiment</option><option value="NEGATIVE">Negative</option><option value="NEUTRAL">Neutral</option><option value="POSITIVE">Positive</option>
        </Select>
        <Select className="w-auto" value={priority} onChange={(e) => { setPriority(e.target.value as Priority | ''); setPage(1); }} aria-label="Filter by priority">
          <option value="">All priorities</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
        </Select>
        <Button variant="secondary" onClick={() => void reload()}>Refresh</Button>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <EmptyState title="No feedback yet">Scan a QR code above to submit a test entry.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.items.map((f) => (
            <li key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500" aria-label={`${f.rating} of 5 stars`}>{'★'.repeat(f.rating)}<span className="text-slate-200">{'★'.repeat(5 - f.rating)}</span></span>
                  <Badge>{humanize(f.type.toLowerCase())}</Badge>
                </div>
                <span className="text-xs text-slate-500">{f.facility.name}{f.ward && ` · ${f.ward}`} · {fmtDateTime(f.createdAt)}</span>
              </div>
              {f.text && <p className="mt-2 text-sm text-slate-800">{f.text}</p>}
              {f.analysis ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <SentimentBadge sentiment={f.analysis.sentiment} />
                  <PriorityBadge priority={f.analysis.priority} />
                  <Badge tone="blue">{humanize(f.analysis.category)}</Badge>
                  {f.analysis.topics.map((t) => <Badge key={t}>{humanize(t)}</Badge>)}
                  <span className="text-xs text-slate-400">{f.analysis.engine === 'LLM' ? 'AI model' : 'rule engine'}</span>
                  {f.analysis.summary && <p className="w-full text-xs text-slate-500">{f.analysis.summary}</p>}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">Analysis pending…</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-slate-500">Page {page} of {pages}</span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
