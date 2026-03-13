# GAS Deployment Guide

## 주의

- 이 문서는 현재 저장소의 최신 `yy-integrated-backend-v3.gs` 기준 배포 절차입니다.
- 운영 기준 시트는 별도 문서인 [운영_가이드라인_3시트_기준.md](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/운영_가이드라인_3시트_기준.md)를 우선합니다.
- 즉, 배포 절차는 이 문서를 따르되, 실제 운영 원본은 `양양이음터강사DB`, `이용자DB`, `문의접수` 3개 시트로 정렬해야 합니다.

## 대상 파일

- [yy-integrated-backend-v3.gs](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/gas/yy-integrated-backend-v3.gs)
- [yy-local-badge-sync.gs](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/gas/yy-local-badge-sync.gs)

## 배포 순서

1. 새 Google Apps Script 프로젝트를 엽니다.
2. 기본 `Code.gs` 내용을 지우고 `yy-integrated-backend-v3.gs` 내용으로 교체합니다.
3. 필요한 경우 `yy-local-badge-sync.gs`를 별도 파일로 추가합니다.
4. `SPREADSHEET_ID`와 `API_KEY`가 현재 운영값과 맞는지 확인합니다.
5. `Deploy > New deployment > Web app`으로 배포합니다.
6. 웹앱 URL의 `/exec` 주소를 확보합니다.

## 중복 함수 금지

- Apps Script 프로젝트 안에 `doGet`, `doPost`는 최신 버전 기준으로 하나만 유지해야 합니다.
- 예전 `인증 관리 GAS 코드`나 구버전 백엔드 파일이 같은 프로젝트에 남아 있으면, `POST`는 옛 `doPost`가 실행되고 `GET`은 새 `doGet`이 실행되는 식으로 충돌할 수 있습니다.
- 이 경우 `health`는 정상인데 `registerMember`가 `Unknown action`을 반환하는 현상이 발생합니다.
- 해결 방법은 최신 [yy-integrated-backend-v3.gs](/mnt/g/진행중프로젝트/개인프로젝트/개발_202602/yy-rural-center-main/iumteo/docs/gas/yy-integrated-backend-v3.gs)의 `doGet`, `doPost`만 남기고, 이전 파일의 `doGet`, `doPost`는 삭제하거나 함수명을 변경하는 것입니다.

## 이번 버전 핵심 액션

- `GET action=getUser`
- `GET action=getInstructors`
- `POST action=registerMember`
- `POST action=registerInstructor`
- `POST action=updateMemberProfile`
- `POST action=updateInstructorProfile`
- `POST action=updateInquiryStatus`
- `POST action=inquiry`

## Next.js 연결

`iumteo/.env.local` 예시:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret
GAS_API_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec
GAS_API_KEY=yy-iumteo-secret-key-2026
```

## 최소 확인 API

헬스체크:

```text
GET {GAS_API_URL}?action=health
```

사용자 조회:

```text
GET {GAS_API_URL}?action=getUser&email=admin@yangyang.go.kr&apiKey={GAS_API_KEY}
```

강사 전체 조회:

```text
GET {GAS_API_URL}?action=getInstructors&includeAll=Y&apiKey={GAS_API_KEY}
```

## 운영 기준

- 장기 운영 기준은 `양양이음터강사DB`, `이용자DB`, `문의접수` 3개 시트입니다.
- 현재 시트는 실데이터가 `Row 2`부터 시작하므로, GAS도 이를 기준으로 처리합니다.
- 이메일은 모든 시트에서 소문자 기준으로 통일하는 편이 안전합니다.
- `이용자DB`, `문의접수`는 공개 CSV로 운영하면 안 됩니다.
- `Users`, `Lecturer_Profiles`는 과거 구조로 간주하고 신규 운영 기준에서는 제외합니다.
