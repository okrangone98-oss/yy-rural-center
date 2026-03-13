# Admin Design QA Checklist

- [ ] 관리자 계정 로그인 후 `/admin` 진입 가능
- [ ] 좌측 패널에서 `ADMIN / INSTRUCTOR / USER / GUEST` 미리보기 전환 가능
- [ ] 미리보기 모드(`INSTRUCTOR/USER/GUEST`)에서 강사 연락처/이메일 블라인드 처리 확인
- [ ] 미리보기 모드에서 강사 프로필 저장 버튼 비활성화 확인
- [ ] `회원 관리` 탭에서 회원 검색/상태 필터/기본 정보 저장 가능
- [ ] `시트 통합 관리` 탭에서 3개 운영 시트(강사DB/이용자DB/문의접수) 동시 로드 확인
- [ ] 강사 승인 큐에서 `승인 / 대기 / 삭제요청` 상태 변경과 기본 정보 저장 가능
- [ ] 문의 운영함에서 수동 상태 변경, 강사 전달 메일, 회원 회신 메일 동작 확인
- [ ] 무결성 진단 카드에 중복 이메일/시트간 중복/필수값 누락/강사명 불일치 경고 노출 확인
- [ ] `강사 목록 조회` 탭 검색/로컬 필터/새로고침 동작 확인
- [ ] 모바일 폭(360px~)에서 사이드 패널/테이블 가로 스크롤 깨짐 없는지 확인
- [ ] 최신 GAS 재배포 후 `registerMember`, `registerInstructor`, `updateInstructorProfile`, `updateMemberProfile`, `updateInstructorStatus`, `updateInquiryStatus`, `getInstructors(includeAll)` API 정상 응답 확인
