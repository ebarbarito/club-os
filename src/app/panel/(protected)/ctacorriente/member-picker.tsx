'use client';

import { useRouter } from 'next/navigation';
import { MemberSearch, type SearchableMember } from '@/components/member-search';

export function MemberPicker({ members, value }: { members: SearchableMember[]; value: string }) {
  const router = useRouter();

  return (
    <div className="max-w-md">
      <MemberSearch members={members} value={value} onChange={(id) => router.push(`/panel/ctacorriente?member=${id}`)} />
    </div>
  );
}
