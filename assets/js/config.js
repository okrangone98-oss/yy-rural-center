// ====== Sheet CSV URLs (Google Sheets published as CSV) ======
// How to get URL:
// 1) Google Sheet > File > Share > Publish to web > CSV
// 2) Copy the published URL with output=csv
// 3) Paste below

window.SHEET_CONFIG = {
  teachers: {
    submitUrl: "https://script.google.com/macros/s/AKfycbx_aMmZsinjDb-cQIJeuX02l3hFUsFlEi0UlZtebYDwUigN_8mfpCZNC3RO6LZEl6uxpg/exec",
    csvUrl: "/iumteo/api/proxy/csv?sheet=강사DB",
    fallbackUrl: "/iumteo/api/proxy/csv?sheet=강사DB"
  },
  notices: {
    csvUrl: "/iumteo/api/proxy/csv?sheet=공지사항",
  },
  popup: {
    csvUrl: "/iumteo/api/proxy/csv?sheet=팝업관리"
  },
  videos: {
    csvUrl: "/iumteo/api/proxy/csv?sheet=영상관리"
  },
  programs: {
    "2024": "/iumteo/api/proxy/csv?sheet=2024사업",
    "2025": "/iumteo/api/proxy/csv?sheet=2025사업",
    "2026": "/iumteo/api/proxy/csv?sheet=2026사업"
  },
  pd: {
    "2025": "/iumteo/api/proxy/csv?sheet=2025_PD",
    "2026": "/iumteo/api/proxy/csv?sheet=2026_PD"
  },
  users: {
    csvUrl: "/iumteo/api/proxy/csv?sheet=이용자DB"
  },
  inquiries: {
    csvUrl: "/iumteo/api/proxy/csv?sheet=문의내역"
  }
};

window.IUMTEO_STORAGE_CONFIG = {
  instructorRegister: {
    projectId: "instructor-register",
    storageBucket: "instructor-register.firebasestorage.app",
    profilePhotoFolder: "instructor-register/profile-photos",
    legacyProfilePhotoFolder: "profile_photos",
    uploadApiCandidates: [
      "https://yycenter.kr/iumteo/api/uploads/profile-photo",
      "/iumteo/api/uploads/profile-photo",
      "http://localhost:3000/api/uploads/profile-photo",
      "http://127.0.0.1:3000/api/uploads/profile-photo",
      "http://localhost:3001/api/uploads/profile-photo",
      "http://127.0.0.1:3001/api/uploads/profile-photo"
    ]
  },
  homepageMedia: {
    projectId: "yy-content-system",
    storageBucket: "yy-content-system.firebasestorage.app",
    usage: ["pd-photos", "homepage-images", "homepage-videos"]
  }
};


window.IUMTEO_DATA_SOURCE = {
  teachers: {
    provider: 'google-sheets',
    useSampleFallback: true
  }
};

window.IUMTEO_SAMPLE_DATA = {
  teachers: [
    {
      name: '김윤지',
      org: '양양군 농촌활성화지원센터',
      field: '농촌활성화 기획과 공동체 프로그램 운영',
      career: '주민 참여형 프로그램 운영 5년\n지역 연계 프로젝트 기획 다수',
      email: 'sample1@yy-rural-center.kr',
      instagram: '',
      insta_open: 'N',
      category: '공동체 / 기획',
      info_open_agree: '동의',
      isLocal: true,
      phone: '010-1234-5678',
      address: '강원특별자치도 양양군',
      password: '1234',
      profile_photo: 'images/김윤지.png',
      status: '승인'
    },
    {
      name: '심예슬',
      org: '양양 로컬 콘텐츠랩',
      field: '로컬 브랜딩, 문화기획, 청년 프로그램 코디네이션',
      career: '지역 문화행사 운영 4년\n브랜드 캠페인 기획 및 강의 진행',
      email: 'sample2@yy-rural-center.kr',
      instagram: '',
      insta_open: 'N',
      category: '브랜딩 / 문화기획',
      info_open_agree: '동의',
      isLocal: true,
      phone: '010-2222-3333',
      address: '강원특별자치도 양양군',
      password: '1234',
      profile_photo: 'images/심예슬.png',
      status: '승인'
    },
    {
      name: '성동제',
      org: '양양 생활기술 워크숍',
      field: '생활기술 교육, 주민 워크숍, 체험형 프로그램 진행',
      career: '마을 단위 워크숍 다수 운영\n생활기술 교육 커리큘럼 개발',
      email: 'sample3@yy-rural-center.kr',
      instagram: '',
      insta_open: 'N',
      category: '체험 / 워크숍',
      info_open_agree: '동의',
      isLocal: false,
      phone: '010-4444-5555',
      address: '강원특별자치도 양양군',
      password: '1234',
      profile_photo: 'images/성동제.png',
      status: '승인'
    }
  ]
};
