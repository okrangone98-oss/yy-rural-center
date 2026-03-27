import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { assertGasSuccess, gasPost, isGasConfigured, type GasEnvelope } from '@/lib/gas-api';
import { registerPayloadSchema, type MirrorInstructorProfile, type MirrorUserRecord } from '@/lib/domain';
import { upsertMirrorInstructorProfile, upsertMirrorUser } from '@/lib/firestore-mirror';

function nowIso() {
  return new Date().toISOString();
}

export async function POST(request: Request) {
  try {
    if (!isGasConfigured()) {
      return NextResponse.json(
        { success: false, message: '회원가입 설정이 아직 완료되지 않았습니다. 관리자 환경변수를 확인해 주세요.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = registerPayloadSchema.parse(body);
    const session = await getServerSession(authOptions);

    const email = (session?.user?.email || parsed.email).trim().toLowerCase();
    const name = parsed.name || session?.user?.name || email.split('@')[0];
    const provider = session?.user?.provider || 'credentials';
    const role = parsed.memberType === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER';
    const consentDate = nowIso();

    const userMirror: MirrorUserRecord = {
      id: email,
      email,
      name,
      phone: parsed.phone,
      role,
      actualRole: role,
      provider,
      organization: parsed.org,
      memberType: parsed.memberType,
      consent: {
        requiredAccepted: parsed.consent.requiredAccepted,
        profilePublicAccepted: parsed.consent.profilePublicAccepted,
        marketingAccepted: parsed.consent.marketingAccepted,
        consentVersion: parsed.consent.consentVersion,
        consentDate,
      },
      createdAt: consentDate,
      updatedAt: consentDate,
    };

    const action = parsed.memberType === 'INSTRUCTOR' ? 'registerInstructor' : 'registerMember';
    const sheetSync = assertGasSuccess(
      await gasPost<GasEnvelope<any>>({
      action,
      email,
      name,
      phone: parsed.phone,
      password: parsed.password || '',
      org: parsed.org,
      provider,
      memberType: parsed.memberType,
      field: parsed.field,
      area: parsed.area,
      intro: parsed.intro,
      career: parsed.career,
      address: parsed.address,
      instagram: parsed.instagram,
      instagramOpen: parsed.instagramOpen,
      portfolioLink: parsed.portfolioLink,
      profilePhoto: parsed.profilePhoto,
      profilePublicAccepted: parsed.consent.profilePublicAccepted,
      marketingAccepted: parsed.consent.marketingAccepted,
      consentVersion: parsed.consent.consentVersion,
      consentDate,
      }),
      action,
    );

    let profileMirror = null;

    if (parsed.memberType === 'INSTRUCTOR') {
      const instructorProfile: MirrorInstructorProfile = {
        id: email,
        email,
        name,
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
        approvalStatus: 'PENDING',
        createdAt: consentDate,
        updatedAt: consentDate,
      };

      profileMirror = await upsertMirrorInstructorProfile(instructorProfile);
    }

    const mirrorSync = await upsertMirrorUser(userMirror);

    return NextResponse.json({
      success: true,
      message: parsed.memberType === 'INSTRUCTOR' ? '강사 가입이 접수되었습니다.' : '일반회원 가입이 완료되었습니다.',
      data: {
        sheetSync,
        mirrorSync,
        profileMirror,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '회원가입 처리에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
