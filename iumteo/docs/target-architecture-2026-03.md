# Yangyang Iumteo Target Architecture

## 운영 원칙

- 원본 DB는 당분간 `Google Sheets + GAS`
- 운영 기준 시트는 `양양이음터강사DB`, `이용자DB`, `문의접수` 3개만 사용
- `Users`, `Lecturer_Profiles`는 운영 원본에서 제외
- `Firestore`는 미러 DB와 운영 보조 인덱스 역할
- `instructor-register`는 회원/강사/문의용 Firebase 프로젝트
- `yy-content-system`은 홈페이지 미디어 전용 Firebase 프로젝트
- 강사 프로필 사진은 `instructor-register`의 Storage로 저장
- 메일 발송은 `Next.js API + SMTP`

## 권장 폴더 구조

- `src/app`
  페이지와 API 라우트
- `src/lib`
  인증, RBAC, GAS 호출, Firebase Admin, 미러링, 메일
- `src/components`
  로그인/가입/프로필/문의 UI 컴포넌트
- `docs`
  운영 문서, GAS, 환경설정, QA

## 데이터 흐름

### 회원가입

1. 사용자가 `register` 페이지에서 일반회원 또는 강사를 선택
2. 일반회원은 `이용자DB`, 강사는 `양양이음터강사DB`로 저장
3. 같은 요청에서 Firestore 미러 컬렉션에 복제
4. 강사는 `approvalStatus=PENDING`으로 시작

### 프로필 수정

1. 강사 또는 회원이 자신의 프로필 수정
2. Next API가 Google Sheets 반영
3. 성공 시 Firestore 미러 동기화
4. 강사 사진은 `/api/uploads/profile-photo`를 통해 `instructor-register` Storage URL로 저장

### 문의 흐름

1. 일반회원이 강사 문의 접수
2. 문의는 Google Sheets와 Firestore `inquiries`에 동시 저장
3. 센터 알림 메일 발송
4. 관리자가 검토 후 강사에게 전달
5. 강사 회신 내용을 센터가 확인 후 회원에게 재발송

## Firestore 컬렉션

- `users`
- `lecturer_profiles`
- `inquiries`
- `mail_outbox`

## 현재 구현 상태

- 완료
  `register` 페이지
  `account/register`, `account/profile`, `inquiries` API
  `admin/mirror/sync`, `admin/inquiries/forward`, `admin/inquiries/reply` API
  Firebase Admin 미러 계층
  SMTP 메일 아웃박스 계층
- 다음 작업 권장
  관리자 페이지에 문의함/메일 발송 UI 추가
  강사 마이페이지와 일반회원 마이페이지 분리
  3시트 기준 GAS 액션으로 `register/profile` API 재정렬 후 재배포
