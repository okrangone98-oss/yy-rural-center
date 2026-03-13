# Yangyang Iumteo Next

양양이음터의 인증, 관리자 페이지, 강사/이용자/문의 데이터 연동을 담당하는 Next.js 앱입니다.

## 핵심 연결 구조

- 인증: `NextAuth`가 `GAS_API_URL`의 `getUser`를 호출합니다.
- 강사 관리: `/api/instructor`가 `GAS_API_URL`의 `getInstructors`, `updateInstructorProfile`을 호출합니다.
- 관리자 시트 점검: `/api/admin/sheets`가 `양양이음터강사DB`, `이용자DB`, `문의접수` 3개 CSV를 직접 읽어 무결성 진단을 수행합니다.
- 가입/프로필 수정: `registerMember`, `registerInstructor`, `updateMemberProfile`, `updateInstructorProfile` 액션을 사용합니다.

## 현재 운영 기준

- 원본 운영 시트는 3개만 사용합니다.
  - `양양이음터강사DB`
  - `이용자DB`
  - `문의접수`
- `Users`, `Lecturer_Profiles`는 더 이상 운영 기준으로 사용하지 않습니다.
- 상세 기준은 [운영_가이드라인_3시트_기준.md](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/운영_가이드라인_3시트_기준.md)를 따릅니다.

## 로컬 실행

1. [`.env.example`](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/.env.example)를 기준으로 `iumteo/.env.local`을 만듭니다.
2. `GAS_API_URL`을 새 Apps Script 웹앱 배포 URL로 교체합니다.
3. `npm install`
4. `npm run dev`

## 필수 환경변수

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GAS_API_URL`
- `GAS_API_KEY`

## 선택 환경변수

- `CSV_INSTRUCTOR_DB_URL`
- `CSV_MEMBER_DB_URL`
- `CSV_INQUIRY_DB_URL`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- 또는 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

기본값은 현재 운영 중인 Google Sheets CSV 공개 URL로 코드에 이미 들어 있습니다.

## Firebase 가장 쉬운 연결 방법

1. Firebase Console 또는 Google Cloud에서 서비스 계정 JSON 키를 발급합니다.
2. 파일을 `iumteo/secrets/firebase-service-account.json`으로 저장합니다.
3. `iumteo/.env.local`에 아래 한 줄을 추가합니다.

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
```

4. 개발 서버를 재시작합니다.

수동 입력 방식이 필요하면 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`를 사용할 수 있습니다.

## Firebase 운영 분리

- `instructor-register`
  강사/회원/문의 Firestore 미러와 강사 프로필 사진 저장소
- `yy-content-system`
  홈페이지 사진/동영상 전용 저장소

현재 정적 강사 페이지의 프로필 사진 업로드는 브라우저 Firebase SDK가 아니라 `Next.js API /api/uploads/profile-photo`를 통해 `instructor-register` 버킷으로 저장됩니다.

## GAS 배포 절차

1. [yy-integrated-backend-v3.gs](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/gas/yy-integrated-backend-v3.gs) 내용을 Google Apps Script에 반영합니다.
2. 배포 > 새 배포 > 유형 `웹 앱`으로 배포합니다.
3. 실행 계정은 스프레드시트 편집 권한이 있는 계정으로 설정합니다.
4. 접근 권한은 웹앱 사용 시나리오에 맞게 설정합니다.
5. 발급된 `/exec` URL을 `GAS_API_URL`에 넣습니다.

## 배포 후 확인 포인트

- `GET {GAS_API_URL}?action=health` 응답 확인
- 로그인 페이지에서 관리자 또는 실제 사용자 로그인 확인
- `/admin`에서 `시트 통합 관리` 탭 로드 확인
- 무결성 경고가 있다면 관리자 화면 기준으로 정리

## 참고 문서

- [운영_가이드라인_3시트_기준.md](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/운영_가이드라인_3시트_기준.md)
- [yy-integrated-backend-v3.gs](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/gas/yy-integrated-backend-v3.gs)
- [yy-local-badge-sync.gs](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/gas/yy-local-badge-sync.gs)
- [admin-design-qa-checklist.md](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/admin-design-qa-checklist.md)
- [firebase-project-separation.md](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/firebase-project-separation.md)
