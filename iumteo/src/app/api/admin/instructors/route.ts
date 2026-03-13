import { NextResponse } from 'next/server';
import { adminInstructorUpdateSchema, type MirrorInstructorProfile } from '@/lib/domain';
import { assertGasSuccess, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { updateMirrorInstructorProfile, updateMirrorUser } from '@/lib/firestore-mirror';
import { getRequiredSession } from '@/lib/rbac';

function mapApprovalStatus(status: string, finalStatus: string): MirrorInstructorProfile['approvalStatus'] {
  const normalized = `${finalStatus} ${status}`.trim();
  if (normalized.includes('승인')) return 'APPROVED';
  if (normalized.includes('반려') || normalized.includes('거절')) return 'REJECTED';
  return 'PENDING';
}

export async function POST(request: Request) {
  const { error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = adminInstructorUpdateSchema.parse(body);

    const sheetSync = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
        action: 'updateInstructorProfile',
        email: parsed.email,
        contactEmail: parsed.contactEmail,
        name: parsed.name,
        phone: parsed.phone,
        org: parsed.org,
        field: parsed.field,
        area: parsed.area,
        intro: parsed.intro,
        career: parsed.career,
        address: parsed.address,
        instagram: parsed.instagram,
        instagramOpen: parsed.instagramOpen,
        portfolioLink: parsed.portfolioLink,
        profilePhoto: parsed.profilePhoto,
        isLocal: parsed.isLocal,
        status: parsed.status,
        finalStatus: parsed.finalStatus,
      }),
      'updateInstructorProfile',
    );

    const now = new Date().toISOString();
    const userMirror = await updateMirrorUser(parsed.email, {
      name: parsed.name,
      phone: parsed.phone,
      organization: parsed.org,
      updatedAt: now,
    });

    const profileMirror = await updateMirrorInstructorProfile(parsed.email, {
      name: parsed.name,
      phone: parsed.phone,
      organization: parsed.org,
      field: parsed.field,
      area: parsed.area,
      intro: parsed.intro,
      career: parsed.career,
      address: parsed.address,
      instagram: parsed.instagram,
      instagramOpen: parsed.instagramOpen,
      portfolioLink: parsed.portfolioLink,
      profilePhoto: parsed.profilePhoto,
      isLocal: parsed.isLocal,
      approvalStatus: mapApprovalStatus(parsed.status, parsed.finalStatus),
      updatedAt: now,
    });

    return NextResponse.json({ success: true, data: { sheetSync, userMirror, profileMirror } });
  } catch (instructorError) {
    return NextResponse.json(
      { success: false, message: instructorError instanceof Error ? instructorError.message : '강사 정보 수정 실패' },
      { status: 400 },
    );
  }
}
