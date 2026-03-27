import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import type { AppRole } from '@/lib/domain';

export async function getRequiredSession(roles?: AppRole[]) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 }),
    };
  }

  if (roles && !roles.includes(session.user.role as AppRole)) {
    return {
      session: null,
      error: NextResponse.json({ success: false, message: '권한이 없습니다.' }, { status: 403 }),
    };
  }

  return { session, error: null };
}
