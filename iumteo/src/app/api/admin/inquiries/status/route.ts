import { NextResponse } from 'next/server';
import { adminInquiryStatusSchema, type MirrorInquiry } from '@/lib/domain';
import { assertGasSuccess, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { updateMirrorInquiry } from '@/lib/firestore-mirror';
import { getRequiredSession } from '@/lib/rbac';

function mapInquiryStatus(status: string): MirrorInquiry['status'] {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes('전달') || normalized.includes('forward')) return 'FORWARDED_TO_TEACHER';
  if (normalized.includes('완료') || normalized.includes('회신') || normalized.includes('답변') || normalized.includes('closed')) {
    return 'ANSWERED';
  }
  return 'PENDING_CENTER_REVIEW';
}

export async function POST(request: Request) {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = adminInquiryStatusSchema.parse(body);

    const sheetSync = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
        action: 'updateInquiryStatus',
        inquiryId: parsed.inquiryId,
        status: parsed.status,
      }),
      'updateInquiryStatus',
    );

    const mirrorSync = await updateMirrorInquiry(parsed.inquiryId, {
      status: mapInquiryStatus(parsed.status),
    });

    return NextResponse.json({ success: true, data: { sheetSync, mirrorSync } });
  } catch (inquiryError) {
    return NextResponse.json(
      { success: false, message: inquiryError instanceof Error ? inquiryError.message : '문의 상태 변경 실패' },
      { status: 400 },
    );
  }
}
