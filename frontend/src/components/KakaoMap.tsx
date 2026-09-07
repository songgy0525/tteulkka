'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  { value: 'I20', label: '음식점' },
  { value: 'I21', label: '카페/주점' },
  { value: 'Q', label: '의료' },
  { value: 'S', label: '뷰티' },
  { value: 'G', label: '쇼핑' },
  { value: 'P', label: '교육' },
  { value: 'R', label: '오락' },
];

export default function KakaoMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const currentLocationOverlayRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1000);
  const [category, setCategory] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 업종 분포 통계
  const stats = useMemo(() => {
    if (!stores.length) return null;

    const categoryMap = CATEGORIES.filter(c => c.value);
    const countByLabel = new Map<string, number>();

    for (const store of stores) {
      const matched = categoryMap.find(c => store.categoryCode.startsWith(c.value));
      const label = matched?.label ?? '기타';
      countByLabel.set(label, (countByLabel.get(label) ?? 0) + 1);
    }

    const sorted = [...countByLabel.entries()].sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] ?? 1;
    const selectedLabel = categoryMap.find(c => c.value === category)?.label ?? null;
    const selectedCount = selectedLabel ? (countByLabel.get(selectedLabel) ?? 0) : null;

    return { sorted, maxCount, selectedLabel, selectedCount, total: stores.length };
  }, [stores, category]);

  const initMap = useCallback(() => {
    if (mapInstance.current) { setMapReady(true); return; }
    if (!mapRef.current || !window.kakao?.maps?.Map) return;

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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMap = () => {
      window.kakao.maps.load(() => {
        if (!cancelled) initMap();
      });
    };

    if (window.kakao?.maps?.load) {
      loadMap();
      return () => { cancelled = true; };
    }

    const timer = setInterval(() => {
      if (window.kakao?.maps?.load) {
        clearInterval(timer);
        loadMap();
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [initMap]);

  // 검색 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // 현재 위치 파란 점 마커
  useEffect(() => {
    if (!mapReady || !currentLocation) return;

    if (currentLocationOverlayRef.current) {
      currentLocationOverlayRef.current.setMap(null);
    }

    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 18px; height: 18px;
      background: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(59,130,246,0.5);
    `;

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng),
      content: dot,
      xAnchor: 0.5,
      yAnchor: 0.5,
    });
    overlay.setMap(mapInstance.current);
    currentLocationOverlayRef.current = overlay;
  }, [currentLocation, mapReady]);

  // 타이핑 자동완성 — 300ms debounce, 2자 이상
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(() => searchPlace(searchQuery, true), 300);
    return () => clearTimeout(timer);
  // searchPlace는 useCallback이라 안정적 → 의존성에 포함
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const drawMarkers = useCallback((data: Store[]) => {
    if (clustererRef.current) {
      clustererRef.current.clear();
    } else {
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map: mapInstance.current,
        averageCenter: true,
        minLevel: 4,
        minClusterSize: 2,
      });
    }

    const markers = data.map(store => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(store.lat, store.lng),
      });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedStore(store);
      });
      return marker;
    });

    clustererRef.current.addMarkers(markers);
  }, []);

  const searchStores = useCallback(async () => {
    if (!center || !mapReady) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;

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

      if (requestId !== requestIdRef.current) return;
      setStores(data);
      drawMarkers(data);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      alert('백엔드 서버에 연결할 수 없습니다.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [center, radius, category, mapReady, drawMarkers]);

  // silent=true이면 결과 없어도 alert 안 띄움 (자동완성용)
  const searchPlace = useCallback(async (query: string, silent = false) => {
    if (!query.trim()) return;
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      const results: any[] = data.documents ?? [];
      if (results.length > 0) {
        setSearchResults(results);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
        if (!silent) alert('검색 결과가 없습니다.');
      }
    } catch {
      if (!silent) alert('검색 중 오류가 발생했습니다.');
    }
  }, []);

  const selectSearchResult = useCallback((result: any) => {
    setCenter({ lat: parseFloat(result.y), lng: parseFloat(result.x) });
    setSearchQuery(result.place_name);
    setSearchResults([]);
    setShowResults(false);
  }, []);

  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 기능을 지원하지 않습니다.');
      return;
    }

    const tryIpFallback = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const loc = { lat: data.latitude, lng: data.longitude };
          setCenter(loc);
          setCurrentLocation(loc);
        } else {
          alert('위치를 확인할 수 없습니다.\n지도를 직접 클릭해 위치를 선택해주세요.');
        }
      } catch {
        alert('위치를 확인할 수 없습니다.\n지도를 직접 클릭해 위치를 선택해주세요.');
      }
    };

    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(loc);
        setCurrentLocation(loc);
      },
      async (err) => {
        if (err.code === 1) {
          alert('위치 권한이 차단되어 있습니다.\n브라우저 주소창의 자물쇠 아이콘에서 위치 권한을 허용해주세요.');
        } else {
          await tryIpFallback();
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 지도 — 전체 배경 */}
      <div ref={mapRef} className="absolute inset-0" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <p className="text-gray-400 text-sm">지도 로딩 중...</p>
        </div>
      )}

      {/* 왼쪽 플로팅 패널 */}
      <div className="absolute top-3 left-3 bottom-3 z-10 w-72 flex flex-col gap-2">
        {/* 검색 + 컨트롤 카드 */}
        <div className="bg-white rounded-2xl shadow-xl flex-shrink-0 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-base font-bold text-gray-900">뜰까</h1>
            <p className="text-xs text-gray-400 mt-0.5">지도를 클릭해 위치를 선택하세요</p>
          </div>

          <div className="px-4 pb-4 space-y-3">
            {/* 장소 검색 + 자동완성 */}
            <div className="relative" ref={searchRef}>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPlace(searchQuery)}
                  placeholder="장소 또는 주소 검색"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white text-gray-900 placeholder-gray-400"
                />
                <button
                  onClick={() => searchPlace(searchQuery)}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                >
                  검색
                </button>
              </div>
              {showResults && searchResults.length > 0 && (
                <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  {searchResults.map((r, i) => (
                    <li
                      key={i}
                      onClick={() => selectSearchResult(r)}
                      className="px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <div className="text-sm font-medium text-gray-900 truncate">{r.place_name}</div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{r.address_name}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 현재 위치 */}
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
                <label className="text-xs font-medium text-gray-700">반경</label>
                <span className="text-xs text-blue-600 font-medium">{radius.toLocaleString()}m</span>
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
              <label className="block text-xs font-medium text-gray-700 mb-1.5">카테고리</label>
              <div className="flex flex-wrap gap-1">
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

            {/* 상권 검색 버튼 */}
            <button
              onClick={searchStores}
              disabled={!center || !mapReady || loading}
              className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '검색 중...' : '상권 검색'}
            </button>
          </div>
        </div>

        {/* 결과 목록 카드 */}
        {stores.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b flex-shrink-0">
              {stores.length}개 검색됨
            </div>
            {stores.length >= 300 && (
              <div className="px-3 py-2 bg-amber-50 text-xs text-amber-700 border-b border-amber-100 flex-shrink-0">
                가까운 300개만 표시됩니다. 반경을 줄이거나 카테고리를 선택하세요.
              </div>
            )}

            {/* 업종 분포 통계 */}
            {stats && (
              <div className="px-4 py-3 border-b flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">업종 분포</span>
                  {stats.selectedCount !== null && (
                    <span className="text-xs text-blue-600 font-medium">
                      {stats.selectedLabel} {stats.selectedCount}개 ({Math.round((stats.selectedCount / stats.total) * 100)}%)
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {stats.sorted.map(([label, count]) => {
                    const isSelected = label === stats.selectedLabel;
                    const widthPct = Math.round((count / stats.maxCount) * 100);
                    return (
                      <div key={label} className={`rounded-lg px-2 py-1 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                            {label}
                          </span>
                          <span className={`text-xs tabular-nums ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                            {count}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-gray-300'}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="overflow-y-auto flex-1">
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
            </div>
          </div>
        )}
      </div>

      {/* 선택된 상점 — 하단 플로팅 카드 */}
      {selectedStore && (
        <div className="absolute bottom-4 left-80 right-4 z-10 bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-bold text-base text-gray-900 truncate">{selectedStore.name}</div>
                <div className="text-xs text-blue-600 mt-0.5">{selectedStore.categoryName}</div>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 mb-4">
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-7 flex-shrink-0 text-xs pt-0.5">주소</span>
                <span className="text-gray-700 text-xs leading-relaxed">{selectedStore.address}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 w-7 flex-shrink-0 text-xs pt-0.5">지역</span>
                <span className="text-gray-700 text-xs">
                  {selectedStore.sido} {selectedStore.sigungu} {selectedStore.dong}
                </span>
              </div>
            </div>

            <a
              href={`https://map.kakao.com/?q=${encodeURIComponent(selectedStore.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-yellow-400 text-yellow-900 rounded-xl text-sm font-semibold hover:bg-yellow-500 transition-colors"
            >
              카카오맵에서 보기
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
