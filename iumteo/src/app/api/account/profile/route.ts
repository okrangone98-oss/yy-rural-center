import { NextResponse } from 'next/server';
import { assertGasSuccess, gasGet, gasPost, type GasEnvelope } from '@/lib/gas-api';
import { getRequiredSession } from '@/lib/rbac';
import { profileUpdateSchema } from '@/lib/domain';
import { upsertMirrorInstructorProfile, upsertMirrorUser } from '@/lib/firestore-mirror';

export async function GET() {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    const result = assertGasSuccess(
      await gasGet<GasEnvelope<any>>(
      new URLSearchParams({
        action: 'getUser',
        email: session.user.email || '',
      }),
      ),
      'getUser',
    );

    return NextResponse.json({ success: true, data: result.data || null });
  } catch (fetchError) {
    return NextResponse.json(
      { success: false, message: fetchError instanceof Error ? fetchError.message : '프로필 조회 실패' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const payload = profileUpdateSchema.parse(body);
    const email = session.user.email || '';
    const now = new Date().toISOString();
    const role = session.user.role === 'ADMIN' ? 'INSTRUCTOR' : session.user.role;

    const action = role === 'INSTRUCTOR' ? 'updateInstructorProfile' : 'updateMemberProfile';
    const sheetSync = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
      action,
      email,
      name: payload.name || session.user.name || '',
      phone: payload.phone || '',
      org: payload.org || '',
      field: payload.field || '',
      area: payload.area || '',
      intro: payload.intro || '',
      career: payload.career || '',
      address: payload.address || '',
      instagram: payload.instagram || '',
      instagramOpen: payload.instagramOpen || '',
      portfolioLink: payload.portfolioLink || '',
      profilePhoto: payload.profilePhoto || '',
      profilePublicAccepted: payload.profilePublicAccepted,
      marketingAccepted: payload.marketingAccepted,
      }),
      action,
    );

    const userMirror = await upsertMirrorUser({
      id: email,
      email,
      name: payload.name || session.user.name || email.split('@')[0],
      phone: payload.phone || '',
      role: session.user.role,
      actualRole: session.user.role,
      provider: session.user.provider,
      organization: payload.org || '',
      memberType: role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER',
      consent: {
        requiredAccepted: true,
        profilePublicAccepted: payload.profilePublicAccepted ?? role === 'INSTRUCTOR',
        marketingAccepted: payload.marketingAccepted ?? false,
        consentVersion: 'profile-update-2026-03',
        consentDate: now,
      },
      createdAt: now,
      updatedAt: now,
    });

    let profileMirror = null;

    if (role === 'INSTRUCTOR') {
      profileMirror = await upsertMirrorInstructorProfile({
        id: email,
        email,
        name: payload.name || session.user.name || email.split('@')[0],
        phone: payload.phone || '',
        organization: payload.org || '',
        field: payload.field || '',
        area: payload.area || '',
        intro: payload.intro || '',
        career: payload.career || '',
        address: payload.address || '',
        instagram: payload.instagram || '',
        instagramOpen: payload.instagramOpen || '미공개',
        portfolioLink: payload.portfolioLink || '',
        profilePhoto: payload.profilePhoto || '',
        approvalStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sheetSync,
        userMirror,
        profileMirror,
      },
    });
  } catch (updateError) {
    return NextResponse.json(
      { success: false, message: updateError instanceof Error ? updateError.message : '프로필 수정 실패' },
      { status: 400 },
    );
  }
}
