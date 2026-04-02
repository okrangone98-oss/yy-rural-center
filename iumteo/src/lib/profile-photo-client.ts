import { getAppPath, getSiteOrigin } from '@/lib/app-url';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 1280;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
      image.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

export function getImageFileFromClipboard(event: React.ClipboardEvent<HTMLElement>) {
  const items = Array.from(event.clipboardData?.items || []);
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

export async function compressImageForProfile(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width, MAX_IMAGE_HEIGHT / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 압축을 위한 캔버스를 만들 수 없습니다.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.9;
  let blob: Blob | null = null;

  while (quality >= 0.45) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      break;
    }
    quality -= 0.1;
  }

  if (!blob) {
    throw new Error('이미지 압축에 실패했습니다.');
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error('이미지가 너무 커서 5MB 이하로 압축하지 못했습니다. 더 작은 이미지를 사용해 주세요.');
  }

  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'profile-photo'}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function uploadProfilePhoto(file: File, name: string, email: string) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('name', name || 'instructor');
  formData.append('email', email || 'unknown');

  const response = await fetch(getAppPath('/api/uploads/profile-photo'), {
    method: 'POST',
    body: formData,
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || (!result?.data?.url && !result?.data?.objectPath)) {
    throw new Error(result?.message || '프로필 사진 업로드에 실패했습니다.');
  }

  // url은 Firebase 액세스 토큰이 포함된 완전한 다운로드 URL (항상 로드 가능)
  return String(result.data.url || result.data.objectPath);
}

export async function deleteProfilePhoto(fileUrl: string) {
  if (!fileUrl) return;

  const response = await fetch(getAppPath('/api/uploads/profile-photo'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileUrl }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || (result && result.success === false)) {
    throw new Error(result?.message || '프로필 사진 삭제에 실패했습니다.');
  }
}

export function resolveProfilePhotoPublicUrl(fileUrl?: string | null) {
  const value = String(fileUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return new URL(value, `${getSiteOrigin()}/`).toString();
  // Firebase Storage object path → public URL
  const baseUrl = (process.env.NEXT_PUBLIC_STORAGE_BASE_URL || '').replace(/\/+$/, '');
  if (baseUrl) {
    return `${baseUrl}/${encodeURIComponent(value)}?alt=media`;
  }
  return value;
}
