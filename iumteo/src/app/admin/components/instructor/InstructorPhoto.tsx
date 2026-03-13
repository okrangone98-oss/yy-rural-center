import React, { useRef } from 'react';
import { getImageFileFromClipboard } from '../../utils';

interface InstructorPhotoProps {
  onUpload: (file: File | null) => Promise<void>;
  uploading: boolean;
  photoUrl: string;
  onClear: () => void;
  name: string;
}

export const InstructorPhoto: React.FC<InstructorPhotoProps> = ({
  onUpload,
  uploading,
  photoUrl,
  onClear,
  name,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    const file = getImageFileFromClipboard(e);
    if (file) void onUpload(file);
  };

  return (
    <div 
      onPaste={handlePaste} 
      className="group relative rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-2 transition-all hover:border-blue-400/50 hover:bg-blue-50/10"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {photoUrl ? (
          <>
            <img src={photoUrl} alt={`${name} 프로필`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-white/20 p-3 text-white backdrop-blur-md hover:bg-white/30"
              >
                변경하기
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 rounded-full bg-gray-100 p-4">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="text-sm font-semibold text-gray-900">사진 없음</div>
            <div className="mt-1 text-xs text-gray-500">클릭하거나 이미지를 붙여넣어 등록하세요.</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 p-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5 text-xs font-bold text-blue-700 transition-all hover:bg-blue-100 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              업로드 중...
            </>
          ) : (
            '새 사진 선택 (또는 Paste)'
          )}
        </button>
        {photoUrl && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            사진 삭제
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUpload(file);
          // Reset input so same file can be selected again if needed
          e.target.value = '';
        }}
      />
    </div>
  );
};
