# 이음터 Vercel 배포 체크리스트

## 목표 구조

- 메인 홈페이지: `https://yycenter.kr`
- 이음터 앱: `https://yycenter.kr/iumteo`
- 이음터는 별도 Next.js 프로젝트로 배포하고, 메인 홈페이지에서 링크로 진입합니다.

## 필수 환경변수

- `NEXTAUTH_URL=https://yycenter.kr/iumteo/api/auth`
- `NEXTAUTH_SECRET=<충분히 긴 랜덤 문자열>`
- `NEXT_PUBLIC_APP_BASE_PATH=/iumteo`
- `NEXT_PUBLIC_SITE_URL=https://yycenter.kr/iumteo`
- `GAS_API_URL=<배포된 Apps Script /exec URL>`
- `GAS_API_KEY=<운영 키>`

## Firebase 사용 시 추가 환경변수

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `PROFILE_UPLOAD_ALLOWED_ORIGINS=https://yycenter.kr`

## 배포 전 점검

1. `npm run build` 가 오류 없이 완료되는지 확인
2. `/iumteo`, `/iumteo/instructors`, `/iumteo/notices`, `/iumteo/login`, `/iumteo/register` 가 열리는지 확인
3. 관리자 기본 계정 fallback 이 운영 환경에서 비활성화되는지 확인
4. `/admin` 접근이 관리자에게만 열리는지 확인
5. 강사 상세 페이지가 로컬 API를 통해 로드되는지 확인

## 권장 운영 원칙

- 메인 홈페이지와 이음터는 배포 단위를 분리합니다.
- 루트 홈페이지에서 이음터 링크는 `/iumteo` 경로로 통일합니다.
- 운영 비밀값은 Vercel 환경변수로만 넣고 저장소에는 커밋하지 않습니다.
- Preview 환경에서는 운영 시트·운영 Firebase 대신 테스트용 값을 분리하는 것이 안전합니다.

## 장애 시 확인 순서

1. 공개 페이지가 비면 `GAS_API_URL`, `GAS_API_KEY` 가 올바른지 먼저 확인합니다.
2. 로그인/세션이 꼬이면 `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `/iumteo` basePath 설정을 확인합니다.
3. 공지가 비면 Firebase 환경변수와 Firestore 접근 권한을 확인합니다.
4. 프로필 사진 업로드가 막히면 `PROFILE_UPLOAD_ALLOWED_ORIGINS` 와 `FIREBASE_STORAGE_BUCKET` 을 확인합니다.
5. 문의 메일이 가지 않으면 SMTP 설정과 `CENTER_NOTIFICATION_EMAIL` 을 확인합니다.
