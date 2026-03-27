import { NextResponse } from 'next/server';
import { assertGasSuccess, gasGet, gasPost, isGasConfigured, type GasEnvelope } from '@/lib/gas-api';
import { profileUpdateSchema } from '@/lib/domain';
import { upsertMirrorInstructorProfile, upsertMirrorUser } from '@/lib/firestore-mirror';
import { getRequiredSession } from '@/lib/rbac';

function buildFallbackProfile(sessionUser: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
}) {
  const role = sessionUser.role || 'USER';
  const isInstructor = role === 'INSTRUCTOR' || role === 'ADMIN';

  return {
    name: sessionUser.name || '',
    email: sessionUser.email || '',
    phone: sessionUser.phone || '',
    org: '',
    memberType: isInstructor ? 'INSTRUCTOR' : 'USER',
    status: isInstructor ? '승인 대기' : '활성',
    joinedAt: '',
    field: '',
    area: '',
    intro: '',
    career: '',
    address: '',
    instagram: '',
    instagramOpen: '미공개',
    portfolioLink: '',
    profilePhoto: '',
    finalStatus: isInstructor ? '승인 대기' : '활성',
    updatedAt: '',
  };
}

export async function GET() {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    if (!isGasConfigured()) {
      return NextResponse.json({
        success: true,
        degraded: true,
        saveAvailable: false,
        message: '프로필 조회 설정이 아직 완료되지 않아 기본 계정 정보만 보여드립니다.',
        data: buildFallbackProfile(session.user),
      });
    }

    const result = assertGasSuccess(
      await gasGet<GasEnvelope<any>>(
        new URLSearchParams({
          action: 'getUser',
          email: session.user.email || '',
        }),
      ),
      'getUser',
    );

    return NextResponse.json({ success: true, degraded: false, saveAvailable: true, data: result.data || null });
  } catch (fetchError) {
    return NextResponse.json(
      {
        success: false,
        message: fetchError instanceof Error ? fetchError.message : '프로필 정보를 불러오지 못했습니다.',
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  try {
    if (!isGasConfigured()) {
      return NextResponse.json(
        { success: false, message: '프로필 저장 설정이 아직 완료되지 않았습니다. 관리자 환경변수를 확인해 주세요.' },
        { status: 503 },
      );
    }

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
      {
        success: false,
        message: updateError instanceof Error ? updateError.message : '프로필 저장에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
