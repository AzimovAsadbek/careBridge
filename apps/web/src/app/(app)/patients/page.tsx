'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, fmtDate } from '@/lib/format';
import { session } from '@/lib/session';
import { useI18n } from '@/lib/i18n';
import type { Paginated, PatientListItem, PatientStatus, Priority } from '@/lib/types';
import { PatientStatusBadge, RiskBadge } from '@/components/badges';
import { Avatar, Button, ButtonLink, Card, EmptyState, ErrorState, Icon, Input, Loading, PageHeader, Select } from '@/components/ui';

const RISKS: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];

function PatientsList() {
  const params = useSearchParams();
  const initialRisk = params.get('risk');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<PatientStatus | ''>('');
  const [risk, setRisk] = useState<Priority | ''>(RISKS.includes(initialRisk as Priority) ? (initialRisk as Priority) : '');
  const [page, setPage] = useState(1);
  const { t } = useI18n();
  const tp = t.patients;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (debounced) qs.set('search', debounced);
  if (status) qs.set('status', status);
  if (risk) qs.set('riskLevel', risk);
  const { data, error, loading, reload } = useResource<Paginated<PatientListItem>>(`/patients?${qs}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = !!(debounced || status || risk);
  const clear = () => {
    setSearch('');
    setDebounced('');
    setStatus('');
    setRisk('');
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={tp.title}
        subtitle={data ? tp.subtitle(data.total) : tp.subtitleDefault}
        actions={
          session.user?.role !== 'NURSE' && (
            <ButtonLink href="/patients/new">
              <Icon name="plus" /> {tp.newPatient}
            </ButtonLink>
          )
        }
      />

      <div role="search" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input id="q" type="search" aria-label={tp.search} placeholder={tp.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            id="status"
            aria-label={tp.careStatus}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as PatientStatus | '');
              setPage(1);
            }}
            className="sm:w-44"
          >
            <option value="">{tp.allStatuses}</option>
            {(['ADMITTED', 'DISCHARGED', 'IN_FOLLOW_UP', 'STABLE'] as const).map((v) => (
              <option key={v} value={v}>
                {t.enums.patientStatus[v]}
              </option>
            ))}
          </Select>
          <Select
            id="risk"
            aria-label={tp.risk}
            value={risk}
            onChange={(e) => {
              setRisk(e.target.value as Priority | '');
              setPage(1);
            }}
            className="sm:w-40"
          >
            <option value="">{tp.anyRisk}</option>
            {RISKS.map((v) => (
              <option key={v} value={v}>
                {t.enums.risk[v]}
              </option>
            ))}
          </Select>
        </div>
        {filtered && (
          <Button variant="ghost" onClick={clear} className="self-start sm:self-auto">
            {tp.clearFilters}
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label={tp.loading} rows={5} />
      ) : !data?.items.length ? (
        <EmptyState
          title={filtered ? tp.emptyFiltered : tp.empty}
          icon={filtered ? 'search' : 'user'}
          action={
            filtered ? (
              <Button variant="secondary" size="sm" onClick={clear}>
                {tp.clearFilters}
              </Button>
            ) : undefined
          }
        >
          {filtered ? tp.emptyFilteredHint : tp.emptyHint}
        </EmptyState>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <table className="block w-full text-left text-sm md:table">
            <caption className="sr-only">{tp.title}</caption>
            <thead className="hidden border-b border-line bg-slate-50/70 text-xs text-slate-500 md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">{tp.patient}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{tp.risk}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{tp.careStatus}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{tp.familyDoctor}</th>
                <th scope="col" className="w-10 px-5 py-2.5"><span className="sr-only">{t.common.open}</span></th>
              </tr>
            </thead>
            <tbody className="block divide-y divide-line-soft md:table-row-group">
              {data.items.map((p) => (
                <tr key={p.id} className="relative flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 transition-colors hover:bg-slate-50 md:table-row md:p-0">
                  <td className="flex w-full min-w-0 items-center gap-3 pr-6 md:table-cell md:w-auto md:px-5 md:py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={p.fullName} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/patients/${p.id}`} className="font-medium text-slate-900 after:absolute after:inset-0">
                          {p.fullName}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          {t.common.years(age(p.birthDate))} · {p.sex === 'MALE' ? t.common.male : t.common.female} · {p.district}
                          {p.dischargedAt && ` · ${tp.discharged(fmtDate(p.dischargedAt))}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="md:table-cell md:px-3 md:py-3">
                    <RiskBadge level={p.riskLevel} />
                  </td>
                  <td className="md:table-cell md:px-3 md:py-3">
                    <PatientStatusBadge status={p.status} />
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 md:table-cell">{p.familyDoctor?.fullName ?? '—'}</td>
                  <td className="absolute right-3 top-1/2 -translate-y-1/2 md:static md:translate-y-0 md:px-5 md:py-3">
                    <Icon name="chevronRight" className="ml-auto h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data && pages > 1 && (
        <nav aria-label={t.common.pageOf(page, pages)} className="mt-4 flex items-center justify-between text-meta">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t.common.previous}</Button>
          <span className="tabular-nums text-slate-500">{t.common.pageOf(page, pages)}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t.common.next}</Button>
        </nav>
      )}
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PatientsList />
    </Suspense>
  );
}
