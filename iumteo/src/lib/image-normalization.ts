import path from 'node:path';
import sharp from 'sharp';

const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 1280;

function toJpgName(originalName: string) {
  const base = path.basename(originalName, path.extname(originalName)) || 'profile-photo';
  return `${base}.jpg`;
}

export function assertUploadImageInput(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('원본 이미지는 25MB 이하만 업로드할 수 있습니다.');
  }
}

export async function normalizeProfileImage(input: {
  buffer: Buffer;
  originalName: string;
}) {
  let widthLimit = MAX_DIMENSION;
  let quality = 82;
  let output: Buffer | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    output = await sharp(input.buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: widthLimit,
        height: widthLimit,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({
        quality,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();

    if (output.byteLength <= MAX_OUTPUT_BYTES) {
      const metadata = await sharp(output).metadata();
      return {
        buffer: output,
        contentType: 'image/jpeg',
        originalName: toJpgName(input.originalName),
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: output.byteLength,
        quality,
      };
    }

    if (quality > 55) {
      quality -= 8;
    } else {
      widthLimit = Math.max(720, Math.round(widthLimit * 0.85));
    }
  }

  throw new Error('이미지가 너무 커서 5MB 이하로 압축하지 못했습니다. 더 작은 이미지를 사용해 주세요.');
}
