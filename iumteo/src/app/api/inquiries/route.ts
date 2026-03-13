import { NextResponse } from 'next/server';
import { inquiryCreateSchema, type MailOutboxEntry, type MirrorInquiry } from '@/lib/domain';
import { assertGasSuccess, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { createMirrorInquiry } from '@/lib/firestore-mirror';
import { sendManagedMail } from '@/lib/mail';
import { getRequiredSession } from '@/lib/rbac';

function buildCenterMail(entry: MirrorInquiry): MailOutboxEntry | null {
  const to = process.env.CENTER_NOTIFICATION_EMAIL;
  if (!to) return null;

  return {
    id: `${entry.id}-center`,
    category: 'CENTER_INQUIRY',
    to,
    subject: `[양양이음터 문의접수] ${entry.teacherName} / ${entry.inquirerName}`,
    html: `
      <h2>강사 문의가 접수되었습니다.</h2>
      <p><strong>대상 강사:</strong> ${entry.teacherName}</p>
      <p><strong>신청자:</strong> ${entry.inquirerName}</p>
      <p><strong>연락처:</strong> ${entry.inquirerPhone}</p>
      <p><strong>이메일:</strong> ${entry.inquirerEmail}</p>
      <p><strong>문의 목적:</strong> ${entry.purpose}</p>
      <p><strong>문의 내용:</strong><br/>${entry.message || '-'}</p>
    `,
    relatedInquiryId: entry.id,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const { session, error } = await getRequiredSession(['USER', 'ADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = inquiryCreateSchema.parse(body);
    const now = new Date().toISOString();

    const sheetResult = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
      action: 'inquiry',
      teacherName: parsed.teacherName,
      inquirerName: parsed.inquirerName,
      inquirerPhone: parsed.inquirerPhone,
      inquirerEmail: parsed.inquirerEmail,
      purpose: parsed.purpose,
      message: parsed.message,
      status: '접수대기',
      }),
      'inquiry',
    );

    const rowIndex = sheetResult?.data?.rowIndex;
    const inquiryId = rowIndex ? `sheet-${rowIndex}` : `inquiry-${Date.now()}`;

    const mirrorInquiry: MirrorInquiry = {
      id: inquiryId,
      teacherName: parsed.teacherName,
      teacherEmail: parsed.teacherEmail,
      inquirerName: parsed.inquirerName,
      inquirerPhone: parsed.inquirerPhone,
      inquirerEmail: parsed.inquirerEmail,
      purpose: parsed.purpose,
      message: parsed.message,
      status: 'PENDING_CENTER_REVIEW',
      createdAt: now,
      updatedAt: now,
    };

    const mirrorResult = await createMirrorInquiry(mirrorInquiry);
    const centerMail = buildCenterMail(mirrorInquiry);
    if (centerMail) {
      await sendManagedMail(centerMail);
    }

    return NextResponse.json({
      success: true,
      message: '문의가 접수되었습니다. 센터 확인 후 강사에게 전달됩니다.',
      data: {
        sessionRole: session.user.role,
        inquiryId,
        sheetResult,
        mirrorResult,
      },
    });
  } catch (inquiryError) {
    return NextResponse.json(
      { success: false, message: inquiryError instanceof Error ? inquiryError.message : '문의 접수 실패' },
      { status: 400 },
    );
  }
}
