# Firebase Project Separation

## 운영 분리 기준

### `instructor-register`

양양이음터의 회원, 강사, 문의, 강사 프로필 사진을 담당합니다.

- Firestore mirror
- 강사 프로필 사진 Storage
- 회원/강사/문의 운영 데이터 보조 저장소

### `yy-content-system`

홈페이지 홍보 미디어 전용 프로젝트입니다.

- 홈페이지용 사진
- 홈페이지용 동영상
- 현재 기준으로 PD 사진 4장

## 강사 사진 저장 규칙

- 버킷: `instructor-register.firebasestorage.app`
- 루트 폴더: `instructor-register/profile-photos`
- 하위 구조: `YYYY/MM/timestamp-name-email.ext`

예시:

```text
instructor-register/profile-photos/2026/03/1710258945123-hong-gildong-user-example-com.jpg
```

## 로컬 구성

- Firebase Admin 서비스 계정: `iumteo/secrets/firebase-service-account.json`
- 서버 업로드 API: `/api/uploads/profile-photo`
- 정적 페이지는 브라우저에서 Firebase에 직접 업로드하지 않고 위 API를 통해 업로드

## 주의

- `yy-content-system`을 강사 사진 저장소로 다시 사용하지 않습니다.
- `iumteo/.firebaserc`의 기본 프로젝트는 `instructor-register`입니다.
- 홈페이지 미디어 작업이 필요할 때만 Firebase CLI에서 `homepage-media` 별칭을 사용합니다.
