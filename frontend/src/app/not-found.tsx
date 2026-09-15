import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50 px-4">
      <p className="text-4xl mb-3">🗺️</p>
      <h2 className="text-lg font-bold text-gray-900 mb-1">페이지를 찾을 수 없어요</h2>
      <p className="text-sm text-gray-500 mb-5 text-center">
        주소가 잘못되었거나 삭제된 페이지예요.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
      >
        지도로 돌아가기
      </Link>
    </div>
  );
}
