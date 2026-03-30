export type FieldCategory = {
  key: string;
  label: string;
  keywords: string[];
};

export const FIELD_CATEGORIES: FieldCategory[] = [
  { key: '기타', label: '기타', keywords: [] },
  {
    key: '농촌·공동체·정책',
    label: '농촌·공동체·정책',
    keywords: ['농촌', '공동체', '정책', '귀촌', '마을', '지역', '농촌,공동체,정책'],
  },
  {
    key: '디지털·AI·문해',
    label: '디지털·AI·문해',
    keywords: ['디지털', 'ai', '인공지능', '문해', '리터러시', '스마트폰', '컴퓨터', '디지털,ai,문해'],
  },
  {
    key: '레크레이션·진행',
    label: '레크레이션·진행',
    keywords: ['레크레이션', '진행', '퍼실리테이션', 'mc', '이벤트', '체험', '레크레이션,진행'],
  },
  {
    key: '마케팅·로컬브랜딩',
    label: '마케팅·로컬브랜딩',
    keywords: ['마케팅', '브랜딩', '로컬브랜딩', '홍보', '콘텐츠', '마케팅,로컬브랜딩'],
  },
  {
    key: '미술·공예·예술',
    label: '미술·공예·예술',
    keywords: ['미술', '공예', '예술', '페인팅', '도예', '뜨개', '자수', '미술,공예,예술'],
  },
  {
    key: '사진·아카이브·영상',
    label: '사진·아카이브·영상',
    keywords: ['사진', '아카이브', '영상', '촬영', '편집', '미디어', '사진,아카이브,영상'],
  },
  {
    key: '세무·회계',
    label: '세무·회계',
    keywords: ['세무', '회계', '세금', '재무', '경리', '세무,회계'],
  },
  {
    key: '요리·식문화',
    label: '요리·식문화',
    keywords: ['요리', '식문화', '음식', '쿠킹', '발효', '베이킹', '바리스타', '요리,식문화'],
  },
  {
    key: '정리·실버·복지·치유',
    label: '정리·실버·복지·치유',
    keywords: [
      '정리',
      '실버',
      '복지',
      '치유',
      '수납',
      '어르신',
      '케어',
      '사회복지',
      '정리,실버,복지,치유',
      '정리·실버·복지',
    ],
  },
  {
    key: '환경·생태',
    label: '환경·생태',
    keywords: ['환경', '생태', '자연', '숲', '텃밭', '업사이클', '환경,생태'],
  },
];

export const FIELD_FILTER_OPTIONS = [{ key: 'all', label: '전체 분야' }, ...FIELD_CATEGORIES];

export function matchFieldCategory(fieldValue: string) {
  if (!fieldValue) return '기타';

  const normalized = fieldValue.toLowerCase();
  for (const category of FIELD_CATEGORIES) {
    if (category.key === '기타') continue;
    if (normalized.includes(category.key.toLowerCase())) return category.key;
    if (category.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) return category.key;
  }

  return '기타';
}
