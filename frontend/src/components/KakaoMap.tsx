'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    kakao: any;
  }
}

type Store = {
  id: number;
  name: string;
  categoryCode: string;
  categoryName: string;
  lat: number;
  lng: number;
  address: string;
  sido: string;
  sigungu: string;
  dong: string;
};

const CATEGORIES = [
  { value: '', label: '전체' },
  { value: 'Q01', label: '한식' },
  { value: 'Q02', label: '중식' },
  { value: 'Q03', label: '일식' },
  { value: 'Q04', label: '양식' },
  { value: 'Q05', label: '카페' },
  { value: 'Q09', label: '치킨' },
];

export default function KakaoMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [category, setCategory] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstance.current) return;

    window.kakao.maps.load(() => {
      const defaultCenter = new window.kakao.maps.LatLng(37.5665, 126.9780);
      const map = new window.kakao.maps.Map(mapRef.current, {
        center: defaultCenter,
        level: 5,
      });
      mapInstance.current = map;
      setMapReady(true);

      window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        setCenter({ lat: latlng.getLat(), lng: latlng.getLng() });
      });
    });
  }, []);

  useEffect(() => {
    const tryInit = () => {
      if (window.kakao?.maps) {
        initMap();
        return;
      }
      const timer = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(timer);
          initMap();
        }
      }, 100);
      return () => clearInterval(timer);
    };
    return tryInit();
  }, [initMap]);

  // 선택 위치 변경 시 원 업데이트
  useEffect(() => {
    if (!mapReady || !center) return;

    if (circleRef.current) circleRef.current.setMap(null);

    const circle = new window.kakao.maps.Circle({
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      radius,
      strokeWeight: 2,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      fillColor: '#3B82F6',
      fillOpacity: 0.1,
    });
    circle.setMap(mapInstance.current);
    circleRef.current = circle;

    mapInstance.current.panTo(new window.kakao.maps.LatLng(center.lat, center.lng));
  }, [center, radius, mapReady]);

  const drawMarkers = useCallback((data: Store[]) => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    data.forEach(store => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(store.lat, store.lng),
        map: mapInstance.current,
      });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedStore(store);
      });
      markersRef.current.push(marker);
    });
  }, []);

  const searchStores = useCallback(async () => {
    if (!center || !mapReady) return;

    // 진행 중인 요청 취소
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setSelectedStore(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const params = new URLSearchParams({
        lat: String(center.lat),
        lng: String(center.lng),
        radius: String(radius),
        ...(category && { category }),
      });
      const res = await fetch(`${apiBase}/api/stores?${params}`, {
        signal: controller.signal,
      });
      const data: Store[] = await res.json();
      setStores(data);
      drawMarkers(data);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      alert('백엔드 서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [center, radius, category, mapReady, drawMarkers]);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }, []);

  return (
    <div className="flex h-full w-full">
      {/* 사이드바 */}
      <div className="w-72 flex flex-col bg-white shadow-lg z-10 overflow-y-auto flex-shrink-0">
        {/* 헤더 */}
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-900">뜰까</h1>
          <p className="text-xs text-gray-400 mt-0.5">지도를 클릭해 위치를 선택하세요</p>
        </div>

        {/* 검색 조건 */}
        <div className="p-4 space-y-4 border-b">
          <button
            onClick={getCurrentLocation}
            className="w-full py-2 px-3 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            📍 현재 위치 사용
          </button>

          {center && (
            <p className="text-xs text-gray-400">
              {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
            </p>
          )}

          {/* 반경 슬라이더 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">반경</label>
              <span className="text-sm text-blue-600 font-medium">{radius.toLocaleString()}m</span>
            </div>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>100m</span>
              <span>5km</span>
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === c.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 검색 버튼 */}
          <button
            onClick={searchStores}
            disabled={!center || !mapReady || loading}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '검색 중...' : '상권 검색'}
          </button>
        </div>

        {/* 결과 목록 */}
        <div className="flex-1 overflow-y-auto">
          {stores.length > 0 ? (
            <>
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 sticky top-0">
                {stores.length}개 검색됨
              </div>
              {stores.map(store => (
                <div
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                  className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedStore?.id === store.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">{store.name}</div>
                  <div className="text-xs text-blue-500 mt-0.5">{store.categoryName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{store.dong}</div>
                </div>
              ))}
            </>
          ) : (
            <div className="p-6 text-sm text-gray-400 text-center">
              {center ? '검색 버튼을 눌러보세요' : '지도를 클릭해\n위치를 선택하세요'}
            </div>
          )}
        </div>

        {/* 선택된 상점 상세 */}
        {selectedStore && (
          <div className="p-4 border-t bg-blue-50 flex-shrink-0">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-2">
                <div className="font-semibold text-sm text-gray-900 truncate">{selectedStore.name}</div>
                <div className="text-xs text-blue-600 mt-0.5">{selectedStore.categoryName}</div>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2 leading-relaxed">{selectedStore.address}</div>
          </div>
        )}
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <p className="text-gray-400 text-sm">지도 로딩 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
