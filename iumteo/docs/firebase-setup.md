# Firebase Setup

## 목적

이 앱에서 Firebase는 `Firestore 미러 DB`와 `Storage`에 사용됩니다.

현재 가장 쉬운 연결 방식은 `서비스 계정 JSON 파일 경로`를 사용하는 것입니다.

## 준비물

- Firebase 프로젝트 접근 권한
- Firestore Database 생성 완료
- 서비스 계정 JSON 키 1개

## 설정 절차

1. 서비스 계정 JSON 키를 발급합니다.
2. 파일을 `iumteo/secrets/firebase-service-account.json`으로 저장합니다.
3. `iumteo/.env.local`에 아래 값을 넣습니다.

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
FIREBASE_STORAGE_BUCKET=instructor-register.firebasestorage.app
```

4. 서버를 재시작합니다.

```bash
cd /mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo
node node_modules/next/dist/bin/next dev
```

## 대체 방식

서비스 계정 파일 대신 아래 3개 환경변수를 직접 넣어도 됩니다.

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

`FIREBASE_PRIVATE_KEY`는 줄바꿈을 `\n`으로 이스케이프해서 넣어야 합니다.

## 연결 확인

1. 관리자 로그인
2. `/admin` 접속
3. `Firestore 미러 동기화` 실행

자격증명이 정상이라면 관리자 미러 동기화 API가 더 이상 `Firebase Admin credentials are not configured.`를 반환하지 않습니다.

## 프로젝트 분리 원칙

- `instructor-register`: 강사/회원/문의 DB 보조 저장소, 강사 프로필 사진
- `yy-content-system`: 홈페이지용 사진, 동영상, PD 사진
