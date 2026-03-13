# Admin Stack And Firebase Status

## 설치한 패키지

- `zod`
  서버/클라이언트 입력 검증, 시트/GAS 응답 스키마 검증
- `react-hook-form`
  관리자 CRUD 폼 상태 관리
- `@hookform/resolvers`
  `zod`와 폼 검증 연결
- `@tanstack/react-query`
  관리자 페이지의 목록 조회, 캐시, 재조회, 낙관적 업데이트
- `@tanstack/react-table`
  강사/회원/문의/승인 대기열 같은 운영 테이블 구성
- `firebase`
  향후 Firestore 실시간 구독 또는 Firebase Auth/Storage 클라이언트 연동용

## 현재 RBAC 상태

- 인증: `next-auth`
- 라우트 보호: `src/middleware.ts`
- 역할: `GUEST`, `USER`, `INSTRUCTOR`, `ADMIN`
- 현재는 역할 기반 접근 제어가 코드로 이미 존재함

## 현재 Firebase 연동 상태

현재 소스 기준으로는 `Firebase Storage`만 실사용에 가깝고, `Firestore`는 운영 원본으로 연결되어 있지 않습니다.

- 사용 중
  `iumteo/index.html`에서 프로필 사진 업로드를 Firebase Storage로 처리
- 설정만 있음
  `firebase.json`, `firestore.rules`, `firebase-admin` 의존성
- 아직 미구현 또는 미연결
  Next 관리자 앱에서 Firestore CRUD
  Google Sheets <-> Firestore 자동 동기화
  Firestore를 원본 DB로 사용하는 서버 로직

## 현재 원본 DB

현재 운영 원본은 Google Sheets입니다.

- 강사 공개/운영 데이터: `양양이음터강사DB`
- 이용자 데이터: `이용자DB`
- 문의 운영 데이터: `문의접수`
- `Users`, `Lecturer_Profiles`는 운영 기준에서 제외
- GAS 웹앱과 관리자 진단은 위 3개 시트를 기준으로 정렬하는 것이 맞음

## 결론

- 지금 DB들이 Firebase Firestore에 실시간 연동되고 있다고 보기는 어렵습니다.
- 정확히는 `사진은 Firebase Storage`, `업무 데이터 원본은 Google Sheets + GAS` 구조입니다.
- Firestore를 실제 운영 DB나 미러 DB로 쓰려면 3개 운영 시트를 기준으로 동기화해야 합니다.
