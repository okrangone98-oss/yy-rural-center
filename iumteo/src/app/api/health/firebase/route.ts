/**
 * Firebase 연결 진단 엔드포인트 (관리자 전용)
 * GET /api/health/firebase
 *
 * 단계별 점검:
 * 1. 환경변수 존재 여부
 * 2. Firebase Admin 앱 초기화
 * 3. Storage 버킷 존재 확인
 * 4. 테스트 파일 쓰기/삭제 (실제 업로드 권한 확인)
 */
import { NextResponse } from 'next/server';
import { getRequiredSession } from '@/lib/rbac';
import {
  getFirebaseStorageBucketCandidates,
  getFirebaseAdminApp,
  getStorageAdminBucket,
  isFirebaseMirrorEnabled,
} from '@/lib/firebase-admin';

type StepResult = {
  ok: boolean;
  message: string;
  detail?: string;
};

export async function GET() {
  const { session, error } = await getRequiredSession(['ADMIN']);
  if (error) return error;

  const steps: Record<string, StepResult> = {};

  // ── Step 1: 환경변수 확인 ──────────────────────────────────────────────
  const envCheck = {
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_STORAGE_BUCKET: !!process.env.FIREBASE_STORAGE_BUCKET,
  };
  const missingEnvs = Object.entries(envCheck)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  steps.env = {
    ok: missingEnvs.length === 0,
    message: missingEnvs.length === 0 ? '환경변수 모두 존재' : `누락된 환경변수: ${missingEnvs.join(', ')}`,
    detail: JSON.stringify(envCheck),
  };

  if (!steps.env.ok) {
    return NextResponse.json({ ok: false, steps });
  }

  // ── Step 2: Firebase Admin 초기화 ────────────────────────────────────
  try {
    getFirebaseAdminApp();
    steps.init = { ok: true, message: 'Firebase Admin 초기화 성공' };
  } catch (initError) {
    steps.init = {
      ok: false,
      message: 'Firebase Admin 초기화 실패',
      detail: initError instanceof Error ? initError.message : String(initError),
    };
    return NextResponse.json({ ok: false, steps });
  }

  // ── Step 3: Storage 버킷 존재 확인 ──────────────────────────────────
  const candidates = getFirebaseStorageBucketCandidates();
  steps.bucket = { ok: false, message: '', detail: `시도한 버킷: ${candidates.join(', ')}` };

  let workingBucket: string | null = null;

  for (const bucketName of candidates) {
    try {
      const bucket = getStorageAdminBucket(bucketName);
      const [exists] = await bucket.exists();
      if (exists) {
        workingBucket = bucketName;
        steps.bucket = {
          ok: true,
          message: `버킷 확인 성공: ${bucketName}`,
          detail: `시도한 버킷: ${candidates.join(', ')}`,
        };
        break;
      } else {
        steps.bucket.detail += ` | ${bucketName}: 존재하지 않음`;
      }
    } catch (bucketError) {
      steps.bucket.detail += ` | ${bucketName}: ${bucketError instanceof Error ? bucketError.message : String(bucketError)}`;
    }
  }

  if (!workingBucket) {
    steps.bucket.message = 'Storage 버킷을 찾을 수 없습니다. Firebase Console > Storage에서 버킷을 초기화해 주세요.';
    return NextResponse.json({ ok: false, steps });
  }

  // ── Step 4: 테스트 파일 쓰기/삭제 ───────────────────────────────────
  const testPath = `_health_check_/${Date.now()}.txt`;
  try {
    const bucket = getStorageAdminBucket(workingBucket);
    const file = bucket.file(testPath);

    await file.save(Buffer.from('health-check'), {
      resumable: false,
      contentType: 'text/plain',
    });
    await file.delete({ ignoreNotFound: true });

    steps.write = { ok: true, message: '쓰기/삭제 권한 확인 성공' };
  } catch (writeError) {
    steps.write = {
      ok: false,
      message: '쓰기 권한 없음 — Firebase Console > IAM에서 서비스 계정에 Storage Object Admin 역할을 부여해 주세요.',
      detail: writeError instanceof Error ? writeError.message : String(writeError),
    };
    return NextResponse.json({ ok: false, steps });
  }

  return NextResponse.json({
    ok: true,
    message: '모든 Firebase Storage 점검 통과',
    workingBucket,
    steps,
    checkedBy: session.user.email,
  });
}
