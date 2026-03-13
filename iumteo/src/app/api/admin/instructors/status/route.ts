import { NextResponse } from 'next/server';
import { adminInstructorStatusSchema } from '@/lib/domain';
import { assertGasSuccess, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { updateMirrorInstructorProfile } from '@/lib/firestore-mirror';
import { getRequiredSession } from '@/lib/rbac';

function mapApprovalStatus(status: string) {
  if (status === '승인') return 'APPROVED' as const;
  if (status.includes('반려') || status.includes('거절')) return 'REJECTED' as const;
  return 'PENDING' as const;
}

export async function POST(request: Request) {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = adminInstructorStatusSchema.parse(body);

    const sheetSync = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
        action: 'updateInstructorStatus',
        email: parsed.email,
        status: parsed.status,
      }),
      'updateInstructorStatus',
    );

    const mirrorSync = await updateMirrorInstructorProfile(parsed.email, {
      approvalStatus: mapApprovalStatus(parsed.status),
    });

    return NextResponse.json({ success: true, data: { sheetSync, mirrorSync } });
  } catch (statusError) {
    return NextResponse.json(
      { success: false, message: statusError instanceof Error ? statusError.message : '강사 상태 변경 실패' },
      { status: 400 },
    );
  }
}
