import { GenericRecord, InstructorProfile } from '../types';

export const STATUS = {
  active: '활성',
  hidden: '숨김',
  deleteRequested: '삭제요청',
};

export const MEMBER_STATUS_OPTIONS = ['활성', '휴면', '탈퇴', '검토중'];
export const MEMBER_TYPE_OPTIONS = ['일반회원', '기관회원', '주민', '담당자'];
export const INQUIRY_STATUS_PRESETS = ['운영확인중', '강사전달완료', '회원회신완료'];
export const INSTRUCTOR_STATUS_OPTIONS = ['활성', '숨김', '삭제요청'];

export const PUBLIC_PAGE_SIZE = 20;

export function hasMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
}

export function findField(record: GenericRecord, aliases: string[]) {
  for (const alias of aliases) {
    const matchedKey = Object.keys(record).find(
      (key) => key === alias || key.replace(/\s+/g, '') === alias.replace(/\s+/g, ''),
    );
    if (matchedKey && hasMeaningfulValue(record[matchedKey])) {
      return String(record[matchedKey] ?? '').trim();
    }
  }
  return '';
}

export function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

export function getInstructorName(record: GenericRecord) {
  return findField(record, ['성명', 'Name', 'name']);
}

export function getInstructorField(record: GenericRecord) {
  return findField(record, ['전문분야', '강의분야', 'Field', 'field']);
}

export function getInstructorOrg(record: GenericRecord) {
  return findField(record, ['소속', 'Org', 'org']);
}

export function getInstructorArea(record: GenericRecord) {
  return findField(record, ['활동지역', 'Activity_Area', 'Area', 'area']);
}

export function getInstructorPhone(record: GenericRecord) {
  return findField(record, ['연락처', '전화번호', 'Phone', 'phone']);
}

export function getInstructorEmail(record: GenericRecord) {
  return findField(record, ['로그인용 이메일', '이메일', 'Email', 'email']);
}

export function getInstructorIntro(record: GenericRecord) {
  return findField(record, ['소개', '상세내용', 'Intro', 'intro']);
}

export function getInstructorCareer(record: GenericRecord) {
  return findField(record, ['주요경력', 'career']);
}

export function getInstructorAddress(record: GenericRecord) {
  return findField(record, ['주소', 'Address', 'address']);
}

export function getInstructorInstagram(record: GenericRecord) {
  return findField(record, ['인스타그램주소', 'Instagram', 'instagram']);
}

export function getInstructorInstagramOpen(record: GenericRecord) {
  return findField(record, ['인스타그램공개여부', 'instagramOpen']) || '미공개';
}

export function getInstructorPortfolioLink(record: GenericRecord) {
  return findField(record, ['Portfolio_Link', 'portfolioLink']);
}

export function getInstructorProfilePhoto(record: GenericRecord) {
  return findField(record, ['프로필사진', 'Profile_Photo', 'profilePhoto']);
}

export function getInstructorUpdatedAt(record: GenericRecord) {
  return findField(record, ['수정일', 'Updated_At', 'updatedAt']);
}

export function getInstructorStatus(record: InstructorProfile) {
  return findField(record, ['상태', 'status', '승인상태(최종)']) || record.status || STATUS.hidden;
}

export function getInstructorFinalStatus(record: GenericRecord) {
  return findField(record, ['승인상태(최종)', 'finalStatus']) || getInstructorStatus(record as InstructorProfile);
}

export function getMemberName(record: GenericRecord) {
  return findField(record, ['이용자명', '이름', '성명', 'Name', 'name']);
}

export function getMemberEmail(record: GenericRecord) {
  return findField(record, ['이메일', 'Email', 'email']);
}

export function getMemberPhone(record: GenericRecord) {
  return findField(record, ['연락처', '전화번호', 'Phone', 'phone']);
}

export function getMemberOrg(record: GenericRecord) {
  return findField(record, ['소속명', '소속', '기관', 'Org', 'org']);
}

export function getMemberStatus(record: GenericRecord) {
  return findField(record, ['상태', 'status']) || '활성';
}

export function getMemberType(record: GenericRecord) {
  return findField(record, ['회원유형', 'memberType']) || '일반회원';
}

export function getMemberLastLogin(record: GenericRecord) {
  return findField(record, ['Last_Login', '마지막로그인', 'lastLogin']);
}

export function isLocalInstructor(instructor: InstructorProfile) {
  const fieldValue = findField(instructor, ['isLocal', '로컬', '로컬여부']).toUpperCase();
  return instructor.isLocal === 'Y' || ['Y', 'YES', 'TRUE', '1'].includes(fieldValue);
}

export function getInquiryStatusTone(status: string) {
  if (status.includes('완료') || status.includes('회신')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status.includes('전달')) return 'bg-sky-100 text-sky-700 border-sky-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

export function getInstructorStatusTone(status: string) {
  if (status === STATUS.active) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === STATUS.deleteRequested) return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

export function getMemberStatusTone(status: string) {
  if (status.includes('활성')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status.includes('휴면') || status.includes('검토')) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export function getInstructorStatusCategory(status: string) {
  if (status === STATUS.active) return 'approved';
  if (status === STATUS.deleteRequested) return 'deleteRequested';
  if (!status || status === STATUS.hidden) return 'pending';
  return 'other';
}

export function getInquiryStatusCategory(status: string) {
  if (status.includes('완료') || status.includes('회신')) return 'completed';
  if (status.includes('전달')) return 'forwarded';
  return 'pending';
}

export function isMeaningfulRecord(record: GenericRecord, primaryKeys: string[] = []) {
  if (primaryKeys.some((key) => hasMeaningfulValue(record[key]))) {
    return true;
  }

  return Object.entries(record).some(([key, value]) => {
    if (key === 'rowIndex') return false;
    if ((key === '상태' || key === 'status') && String(value || '').trim() === '대기') return false;
    return hasMeaningfulValue(value);
  });
}

export function isMeaningfulInstructor(instructor: InstructorProfile) {
  return isMeaningfulRecord(instructor, ['성명', '강의분야', '전문분야', 'Activity_Area', '활동지역', '연락처', '이메일']);
}

/**
 * 이미지 압축 유틸리티
 */
export async function compressImageForProfile(file: File): Promise<File> {
  // 브라우저 네이티브 기능을 이용한 간단한 압축 (Canvas 이용)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Canvas to Blob conversion failed'));
          }
        }, 'image/jpeg', 0.8);
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * 프로필 사진 업로드 (Firestore/Storage 연동 API 호출 상정)
 */
export async function uploadProfilePhoto(file: File, name: string, email: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('email', email);

  const res = await fetch('/api/admin/instructors/photo', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || '사진 업로드 실패');
  return data.url;
}

/**
 * 클립보드에서 이미지 파일 추출
 */
export function getImageFileFromClipboard(event: React.ClipboardEvent): File | null {
  const items = event.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      return items[i].getAsFile();
    }
  }
  return null;
}
