import { NextResponse } from 'next/server';
import { inquiryReplySchema, type MailOutboxEntry } from '@/lib/domain';
import { assertGasSuccess, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { updateMirrorInquiry } from '@/lib/firestore-mirror';
import { sendManagedMail } from '@/lib/mail';
import { getRequiredSession } from '@/lib/rbac';

export async function POST(request: Request) {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  try {
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
    return NextResponse.json(
      { success: false, message: replyError instanceof Error ? replyError.message : '회원 회신 실패' },
      { status: 400 },
    );
  }
}
