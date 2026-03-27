import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminMemberUpdateSchema } from '@/lib/domain';
import { assertGasSuccess, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { updateMirrorUser } from '@/lib/firestore-mirror';
import { getRequiredSession } from '@/lib/rbac';

export async function POST(request: Request) {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = adminMemberUpdateSchema.parse(body);

    const sheetSync = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
        action: 'updateMemberProfile',
        email: parsed.email,
        name: parsed.name,
        phone: parsed.phone,
        org: parsed.org,
        status: parsed.status,
        memberType: parsed.memberType,
      }),
      'updateMemberProfile',
    );

    const mirrorSync = await updateMirrorUser(parsed.email, {
      name: parsed.name,
      phone: parsed.phone,
      organization: parsed.org,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: { sheetSync, mirrorSync } });
  } catch (memberError) {
    if (memberError instanceof ZodError) {
      return NextResponse.json({ success: false, message: '입력값을 확인해 주세요.' }, { status: 400 });
    }
    console.error('[admin/members POST]', memberError);
    return NextResponse.json({ success: false, message: '회원 정보 수정에 실패했습니다.' }, { status: 500 });
  }
}
