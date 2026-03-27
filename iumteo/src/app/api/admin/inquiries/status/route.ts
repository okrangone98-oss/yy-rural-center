import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminInquiryStatusSchema, type MirrorInquiry } from '@/lib/domain';
import { assertGasSuccess, gasPost, isGasConfigured, type GasEnvelope } from '@/lib/gas-api';
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
    if (!isGasConfigured()) {
      return NextResponse.json(
        { success: false, message: '문의 상태를 변경하려면 GAS 설정이 필요합니다.' },
        { status: 503 },
      );
    }

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
    if (inquiryError instanceof ZodError) {
      return NextResponse.json({ success: false, message: '입력값을 확인해 주세요.' }, { status: 400 });
    }
    console.error('[admin/inquiries/status POST]', inquiryError);
    return NextResponse.json({ success: false, message: '문의 상태 변경에 실패했습니다.' }, { status: 500 });
  }
}
