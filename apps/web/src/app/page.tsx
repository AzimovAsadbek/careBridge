'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor, session } from '@/lib/session';
import { Loading } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const u = session.user;
    router.replace(session.token && u ? homeFor(u.role) : '/login');
  }, [router]);
  return <Loading />;
}
