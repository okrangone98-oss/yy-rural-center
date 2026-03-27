import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { inquiryReplySchema, type MailOutboxEntry } from '@/lib/domain';
import { assertGasSuccess, gasPost, isGasConfigured, type GasEnvelope } from '@/lib/gas-api';
import { updateMirrorInquiry } from '@/lib/firestore-mirror';
import { isMailConfigured, sendManagedMail } from '@/lib/mail';
import { getRequiredSession } from '@/lib/rbac';

export async function POST(request: Request) {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  try {
    if (!isGasConfigured()) {
      return NextResponse.json(
        { success: false, message: '문의 상태를 갱신할 GAS 설정이 아직 완료되지 않았습니다.' },
        { status: 503 },
      );
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        { success: false, message: '회원 답신 메일을 보내려면 SMTP 설정이 필요합니다.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = inquiryReplySchema.parse(body);

    const outboxEntry: MailOutboxEntry = {
      id: `${parsed.inquiryId}-reply`,
      category: 'MEMBER_REPLY',
      to: parsed.memberEmail,
      subject: parsed.subject,
      html: `
        <h2>${parsed.memberName}님, 센터 회신입니다.</h2>
        <p>${parsed.message.replace(/\n/g, '<br/>')}</p>
      `,
      relatedInquiryId: parsed.inquiryId,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };

    const mailResult = await sendManagedMail(outboxEntry);
    const sheetResult = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
        action: 'updateInquiryStatus',
        inquiryId: parsed.inquiryId,
        status: '회원회신완료',
      }),
      'updateInquiryStatus',
    );
    await updateMirrorInquiry(parsed.inquiryId, {
      status: 'ANSWERED',
    });

    return NextResponse.json({ success: true, data: { mailResult, sheetResult } });
  } catch (replyError) {
    if (replyError instanceof ZodError) {
      return NextResponse.json({ success: false, message: '입력값을 확인해 주세요.' }, { status: 400 });
    }
    console.error('[admin/inquiries/reply POST]', replyError);
    return NextResponse.json({ success: false, message: '회원 회신 처리에 실패했습니다.' }, { status: 500 });
  }
}
