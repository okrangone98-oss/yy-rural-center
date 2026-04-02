import { NextResponse } from 'next/server';
import { assertGasSuccess, gasGet, gasPost, isGasConfigured, type GasEnvelope } from '@/lib/gas-api';
import { profileUpdateSchema } from '@/lib/domain';
import {
  getInstructorProfileFromFirestore,
  saveInstructorProfileDirect,
} from '@/lib/firestore-mirror';
import { isFirebaseMirrorEnabled } from '@/lib/firebase-admin';
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

// ─── READ ────────────────────────────────────────────────────────────────────
export async function GET() {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  const email = session.user.email || '';

  // 1차: GAS(구글 시트) 조회
  if (isGasConfigured()) {
    try {
      const result = assertGasSuccess(
        await gasGet<GasEnvelope<any>>(
          new URLSearchParams({ action: 'getUser', email }),
        ),
        'getUser',
      );
      if (result.data) {
        return NextResponse.json({
          success: true,
          degraded: false,
          saveAvailable: true,
          data: result.data,
        });
      }
    } catch (gasError) {
      console.warn('[profile GET] GAS 조회 실패, Firestore 폴백 시도:', gasError);
    }
  }

  // 2차: Firestore 폴백
  if (isFirebaseMirrorEnabled()) {
    try {
      const firestoreProfile = await getInstructorProfileFromFirestore(email);
      if (firestoreProfile) {
        return NextResponse.json({
          success: true,
          degraded: true,
          saveAvailable: true,
          message: 'Google Sheets 연결이 불안정합니다. 저장된 데이터를 불러왔습니다.',
          data: firestoreProfile,
        });
      }
    } catch (firestoreError) {
      console.error('[profile GET] Firestore 조회 실패:', firestoreError);
    }
  }

  // 최종 폴백: 세션 기반 기본값
  return NextResponse.json({
    success: true,
    degraded: true,
    saveAvailable: isGasConfigured() || isFirebaseMirrorEnabled(),
    message: '프로필 정보를 불러오지 못했습니다. 기본 정보를 표시합니다.',
    data: buildFallbackProfile(session.user),
  });
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const { session, error } = await getRequiredSession(['USER', 'INSTRUCTOR', 'ADMIN']);
  if (error) return error;

  const email = session.user.email || '';

  try {
    const body = await request.json();
    const payload = profileUpdateSchema.parse(body);
    const now = new Date().toISOString();
    const role = session.user.role === 'ADMIN' ? 'INSTRUCTOR' : session.user.role;

    const action = role === 'INSTRUCTOR' ? 'updateInstructorProfile' : 'updateMemberProfile';

    let firestoreSaved = false;
    let gasSaved = false;
    const warnings: string[] = [];

    // ── 1. Firestore 저장 (주 경로, Firebase 설정 시 항상 실행) ──
    if (isFirebaseMirrorEnabled()) {
      try {
        await saveInstructorProfileDirect({
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
          instagramOpen: (payload.instagramOpen as '공개' | '미공개') || '미공개',
          portfolioLink: payload.portfolioLink || '',
          profilePhoto: payload.profilePhoto || '',
          approvalStatus: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });
        firestoreSaved = true;
      } catch (firestoreError) {
        console.error('[profile POST] Firestore 저장 실패:', firestoreError);
        warnings.push('Firestore 저장에 실패했습니다.');
      }
    }

    // ── 2. GAS(구글 시트) 동기화 (보조 경로, 실패해도 전체가 막히지 않음) ──
    if (isGasConfigured()) {
      try {
        assertGasSuccess(
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
            password: payload.password,
          }),
          action,
        );
        gasSaved = true;
      } catch (gasError) {
        console.error('[profile POST] GAS 동기화 실패:', gasError);
        warnings.push('Google Sheets 동기화에 실패했습니다. 데이터는 저장되었습니다.');
      }
    }

    // ── 3. 둘 다 실패한 경우 ──
    if (!firestoreSaved && !gasSaved) {
      return NextResponse.json(
        { success: false, message: '프로필 저장에 실패했습니다. Firebase 및 Google Sheets 설정을 확인해 주세요.' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { firestoreSaved, gasSaved },
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (updateError) {
    console.error('[profile POST] 오류:', updateError);
    return NextResponse.json(
      {
        success: false,
        message: updateError instanceof Error ? updateError.message : '프로필 저장에 실패했습니다.',
      },
      { status: 400 },
    );
  }
}
