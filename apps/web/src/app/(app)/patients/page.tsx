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
import { Button, ButtonLink, Card, EmptyState, ErrorState, Field, Icon, Input, Loading, PageHeader, Select } from '@/components/ui';

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

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
        <Field label={tp.search} htmlFor="q">
          <Input id="q" type="search" placeholder={tp.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label={tp.careStatus} htmlFor="status">
          <Select id="status" value={status} onChange={(e) => { setStatus(e.target.value as PatientStatus | ''); setPage(1); }}>
            <option value="">{tp.allStatuses}</option>
            {(['ADMITTED', 'DISCHARGED', 'IN_FOLLOW_UP', 'STABLE'] as const).map((v) => (
              <option key={v} value={v}>{t.enums.patientStatus[v]}</option>
            ))}
          </Select>
        </Field>
        <Field label={tp.risk} htmlFor="risk">
          <Select id="risk" value={risk} onChange={(e) => { setRisk(e.target.value as Priority | ''); setPage(1); }}>
            <option value="">{tp.anyRisk}</option>
            {RISKS.map((v) => (
              <option key={v} value={v}>{t.enums.risk[v]}</option>
            ))}
          </Select>
        </Field>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label={tp.loading} rows={5} />
      ) : !data?.items.length ? (
        <EmptyState title={filtered ? tp.emptyFiltered : tp.empty} icon="user">
          {filtered ? tp.emptyFilteredHint : tp.emptyHint}
        </EmptyState>
      ) : (
        <Card padded={false}>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{tp.title}</caption>
            <thead className="hidden border-b border-line text-xs text-slate-600 md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">{tp.patient}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{tp.careStatus}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{tp.risk}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">{tp.familyDoctor}</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium"><span className="sr-only">{t.common.open}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((p) => (
                <tr key={p.id} className="relative block hover:bg-slate-50 md:table-row">
                  <td className="block px-4 pb-1 pt-3 md:table-cell md:px-5 md:py-3">
                    <Link href={`/patients/${p.id}`} className="font-semibold text-slate-900 after:absolute after:inset-0 hover:text-brand-700">
                      {p.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t.common.years(age(p.birthDate))} · {p.sex === 'MALE' ? t.common.male : t.common.female} · {p.district}
                      {p.dischargedAt && ` · ${tp.discharged(fmtDate(p.dischargedAt))}`}
                    </p>
                  </td>
                  <td className="inline-block pl-4 md:table-cell md:px-3 md:py-3">
                    <PatientStatusBadge status={p.status} />
                  </td>
                  <td className="inline-block pl-2 pb-3 md:table-cell md:px-3 md:py-3">
                    <RiskBadge level={p.riskLevel} />
                  </td>
                  <td className="hidden px-3 py-3 text-slate-700 md:table-cell">{p.familyDoctor?.fullName ?? '—'}</td>
                  <td className="absolute right-4 top-1/2 -translate-y-1/2 md:static md:translate-y-0 md:px-5 md:py-3 md:text-right">
                    <Icon name="chevronRight" className="ml-auto h-4 w-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data && pages > 1 && (
        <nav aria-label={t.common.pageOf(page, pages)} className="mt-4 flex items-center justify-between text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t.common.previous}</Button>
          <span className="text-slate-600">{t.common.pageOf(page, pages)}</span>
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
