'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50 px-4">
      <p className="text-4xl mb-3">😵</p>
      <h2 className="text-lg font-bold text-gray-900 mb-1">문제가 발생했어요</h2>
      <p className="text-sm text-gray-500 mb-5 text-center">
        일시적인 오류일 수 있어요. 다시 시도해주세요.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
