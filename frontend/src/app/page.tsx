import { Suspense } from 'react';
import KakaoMap from '@/components/KakaoMap';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-gray-100">
          <p className="text-gray-400 text-sm">로딩 중...</p>
        </div>
      }
    >
      <KakaoMap />
    </Suspense>
  );
}
