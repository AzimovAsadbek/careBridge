'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, fmtDate } from '@/lib/format';
import { session } from '@/lib/session';
import type { Paginated, PatientListItem, PatientStatus, Priority } from '@/lib/types';
import { PatientStatusBadge, RiskBadge } from '@/components/badges';
import { Button, ButtonLink, EmptyState, ErrorState, Input, Loading, PageHeader, Select } from '@/components/ui';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<PatientStatus | ''>('');
  const [risk, setRisk] = useState<Priority | ''>('');
  const [page, setPage] = useState(1);

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

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={data ? `${data.total} patient${data.total === 1 ? '' : 's'} in your care area` : undefined}
        actions={session.user?.role !== 'NURSE' && <ButtonLink href="/patients/new">+ New patient</ButtonLink>}
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_160px]">
        <Input type="search" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search patients" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value as PatientStatus | ''); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="ADMITTED">In hospital</option>
          <option value="DISCHARGED">Discharged</option>
          <option value="IN_FOLLOW_UP">In follow-up</option>
          <option value="STABLE">Stable</option>
        </Select>
        <Select value={risk} onChange={(e) => { setRisk(e.target.value as Priority | ''); setPage(1); }} aria-label="Filter by risk">
          <option value="">Any risk</option>
          <option value="HIGH">High risk</option>
          <option value="MEDIUM">Medium risk</option>
          <option value="LOW">Low risk</option>
        </Select>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.items.length ? (
        <EmptyState title="No patients found">Try a different search or filter.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {data.items.map((p) => (
              <li key={p.id}>
                <Link href={`/patients/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{p.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {age(p.birthDate)} y · {p.sex === 'MALE' ? 'M' : 'F'} · {p.district} · {p.facility.name}
                      {p.familyDoctor && ` · FD: ${p.familyDoctor.fullName}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PatientStatusBadge status={p.status} />
                    <RiskBadge level={p.riskLevel} />
                    {p.dischargedAt && <span className="text-xs text-slate-400">discharged {fmtDate(p.dischargedAt)}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
