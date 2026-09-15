'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

declare global {
  interface Window { kakao: any; }
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

type Favorite = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius: number;
  category: string;
  total: number;
  score?: number;
};

const CATEGORIES = [
  { value: '', label: '전체', emoji: '🗺️' },
  { value: 'I20', label: '음식점', emoji: '🍽️' },
  { value: 'I21', label: '카페/주점', emoji: '☕' },
  { value: 'Q', label: '의료', emoji: '🏥' },
  { value: 'S01', label: '뷰티', emoji: '💄' },
  { value: 'G', label: '쇼핑', emoji: '🛍️' },
  { value: 'P', label: '교육', emoji: '📚' },
  { value: 'R', label: '오락', emoji: '🎮' },
];

const CATEGORY_COLORS: Record<string, string> = {
  I20: '#EF4444', I21: '#8B5CF6', Q: '#10B981',
  S01: '#EC4899', G: '#3B82F6', P: '#F59E0B', R: '#F97316', 기타: '#9CA3AF',
};

// ── 순수 계산 함수들 ──────────────────────────────────────────────────

function computeScore(stores: Store[], radius: number) {
  if (!stores.length) return null;
  const categoryMap = CATEGORIES.filter(c => c.value);
  const catCounts = new Map<string, number>();
  for (const store of stores) {
    const matched = categoryMap.find(c => store.categoryCode.startsWith(c.value));
    catCounts.set(matched?.value ?? '기타', (catCounts.get(matched?.value ?? '기타') ?? 0) + 1);
  }
  const uniqueCats = [...catCounts.keys()].filter(k => k !== '기타').length;
  const diversity = Math.round((Math.min(uniqueCats, 7) / 7) * 100);
  const areaKm2 = Math.PI * (radius / 1000) ** 2;
  const density = Math.min(Math.round((stores.length / areaKm2 / 300) * 100), 100);
  const dominantPct = Math.max(...catCounts.values()) / stores.length;
  const balance = Math.round((1 - dominantPct) * 100);
  const overall = Math.round(diversity * 0.35 + density * 0.45 + balance * 0.2);
  return { overall, diversity, density, balance, catCounts, areaKm2 };
}

function computeStats(stores: Store[], category: string) {
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
  const selectedLabel = CATEGORIES.find(c => c.value === category)?.label ?? null;
  const selectedCount = selectedLabel ? (countByLabel.get(selectedLabel) ?? 0) : null;
  return { sorted, maxCount, selectedLabel, selectedCount, total: stores.length };
}

function getScoreLabel(s: number) {
  if (s >= 86) return { label: '핵심 상권', color: '#059669' };
  if (s >= 71) return { label: '활성 상권', color: '#2563EB' };
  if (s >= 51) return { label: '발달 상권', color: '#7C3AED' };
  if (s >= 31) return { label: '초기 상권', color: '#D97706' };
  return { label: '상권 척박', color: '#6B7280' };
}

function getSaturation(perKm2: number) {
  if (perKm2 >= 80) return { label: '포화', color: '#EF4444', desc: '진입 위험 — 경쟁 과밀' };
  if (perKm2 >= 40) return { label: '경쟁 심화', color: '#F97316', desc: '차별화 전략 필수' };
  if (perKm2 >= 15) return { label: '적정 경쟁', color: '#10B981', desc: '수요·공급 균형 수준' };
  return { label: '기회', color: '#3B82F6', desc: '경쟁자 적음 — 진입 여지 있음' };
}

function getMostCommonDong(stores: Store[]) {
  const m = new Map<string, number>();
  for (const s of stores) m.set(s.dong, (m.get(s.dong) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '해당 지역';
}

// ── 창업 분석 ────────────────────────────────────────────────────────

const BIZ_COST_REFERENCE: Record<string, { min: number; max: number }> = {
  I20: { min: 5000,  max: 10000 }, // 음식점
  I21: { min: 3000,  max: 8000  }, // 카페/주점
  Q:   { min: 10000, max: 30000 }, // 의료
  S01: { min: 2000,  max: 5000  }, // 뷰티
  G:   { min: 3000,  max: 10000 }, // 쇼핑
  P:   { min: 2000,  max: 5000  }, // 교육
  R:   { min: 3000,  max: 10000 }, // 오락
};

function computeBizScore({
  competition,
  totalBudget,
  monthlyRent,
  category,
  scoreOverall,
}: {
  competition: { saturation: { label: string } } | null;
  totalBudget: number;
  monthlyRent: number;
  category: string;
  scoreOverall: number;
}) {
  // 경쟁 환경 점수 (40%)
  const compLabel = competition?.saturation.label ?? null;
  const compScore =
    compLabel === '기회' ? 100
    : compLabel === '적정 경쟁' ? 70
    : compLabel === '경쟁 심화' ? 35
    : compLabel === '포화' ? 5
    : 50;

  // 예산 충분도 점수 (40%)
  const ref = BIZ_COST_REFERENCE[category];
  let budgetScore = 50;
  if (ref && totalBudget > 0) {
    if (totalBudget >= ref.max)           budgetScore = 100;
    else if (totalBudget >= ref.min)      budgetScore = 75;
    else if (totalBudget >= ref.min * 0.7) budgetScore = 40;
    else                                   budgetScore = 10;
  }

  // 임대료 부담 점수 (20%) — 상권 점수 기반 추정 임대료와 비교
  const estimatedRent =
    scoreOverall >= 80 ? 250
    : scoreOverall >= 65 ? 150
    : scoreOverall >= 45 ? 80
    : 40;
  let rentScore = 70; // 미입력 시 중립
  if (monthlyRent > 0) {
    const ratio = monthlyRent / estimatedRent;
    rentScore = ratio >= 2 ? 100 : ratio >= 1.2 ? 85 : ratio >= 0.9 ? 65 : ratio >= 0.6 ? 35 : 10;
  }

  const overall = Math.round(compScore * 0.4 + budgetScore * 0.4 + rentScore * 0.2);
  return { overall, compScore, budgetScore, rentScore, estimatedRent };
}

function getBizScoreColor(s: number) {
  if (s >= 75) return '#10B981';
  if (s >= 55) return '#3B82F6';
  if (s >= 35) return '#F59E0B';
  return '#EF4444';
}

function getBizScoreLabel(s: number) {
  if (s >= 75) return '창업 적합';
  if (s >= 55) return '검토 가능';
  if (s >= 35) return '주의 필요';
  return '창업 위험';
}

// ── 컴포넌트 ────────────────────────────────────────────────────────

export default function KakaoMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const clustererBRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const circleRefB = useRef<any>(null);
  const currentLocationOverlayRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortControllerBRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const requestIdBRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  // 지도 클릭 핸들러에서 최신 상태를 읽기 위한 refs
  const compareModeRef = useRef(false);
  const activePinRef = useRef<'A' | 'B'>('A');

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── 기본 상태
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
  const [toast, setToast] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const urlInitialized = useRef(false);

  // ── 즐겨찾기
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favTab, setFavTab] = useState<'list' | 'compare'>('list');

  // ── 결과 탭 (분석 | 업체 목록 | 창업)
  const [resultTab, setResultTab] = useState<'analysis' | 'list' | 'biz'>('analysis');

  // ── 창업 계획 모드
  const [bizMode, setBizMode] = useState(false);
  const [bizPlan, setBizPlan] = useState({ totalBudget: '', monthlyRent: '', memo: '' });

  // ── 두 지역 비교 모드
  const [compareMode, setCompareMode] = useState(false);
  const [activePin, setActivePin] = useState<'A' | 'B'>('A');
  const [centerB, setCenterB] = useState<{ lat: number; lng: number } | null>(null);
  const [storesB, setStoresB] = useState<Store[]>([]);
  const [loadingB, setLoadingB] = useState(false);
  const [compareTab, setCompareTab] = useState<'A' | 'B'>('A');

  // refs sync
  useEffect(() => { compareModeRef.current = compareMode; }, [compareMode]);
  useEffect(() => { activePinRef.current = activePin; }, [activePin]);

  // 창업 모드 꺼질 때 탭 리셋
  useEffect(() => { if (!bizMode && resultTab === 'biz') setResultTab('analysis'); }, [bizMode]);

  // 모바일 여부 감지
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── 계산값
  const score = useMemo(() => computeScore(stores, radius), [stores, radius]);
  const scoreB = useMemo(() => computeScore(storesB, radius), [storesB, radius]);
  const stats = useMemo(() => computeStats(stores, category), [stores, category]);
  const statsB = useMemo(() => computeStats(storesB, category), [storesB, category]);
  const scoreInfo = score ? getScoreLabel(score.overall) : null;
  const scoreInfoB = scoreB ? getScoreLabel(scoreB.overall) : null;

  // 경쟁 분석 계산
  const competition = useMemo(() => {
    if (!stores.length || !category || !score) return null;
    const catCount = score.catCounts.get(category) ?? 0;
    const perKm2 = catCount / score.areaKm2;
    const saturation = getSaturation(perKm2);
    const opportunities = CATEGORIES.filter(c => c.value && c.value !== category).filter(c => {
      const count = score.catCounts.get(c.value) ?? 0;
      return (count / score.areaKm2) < 15;
    });
    return { catCount, perKm2: Math.round(perKm2 * 10) / 10, saturation, opportunities };
  }, [stores, category, score]);

  const labelA = stores.length > 0 ? getMostCommonDong(stores) : 'A 지점';
  const labelB = storesB.length > 0 ? getMostCommonDong(storesB) : 'B 지점';

  // 창업 적합도 점수
  const bizScore = useMemo(() => {
    if (!bizMode || !stores.length || !score) return null;
    const totalBudget = parseInt(bizPlan.totalBudget.replace(/[^0-9]/g, '')) || 0;
    const monthlyRent = parseInt(bizPlan.monthlyRent.replace(/[^0-9]/g, '')) || 0;
    return computeBizScore({ competition, totalBudget, monthlyRent, category, scoreOverall: score.overall });
  }, [bizMode, bizPlan, stores, score, competition, category]);

  // ── 초기화
  useEffect(() => {
    if (urlInitialized.current) return;
    urlInitialized.current = true;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const r = searchParams.get('radius');
    const cat = searchParams.get('category');

    if (lat && lng) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (
        Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 &&
        Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180
      ) {
        setCenter({ lat: parsedLat, lng: parsedLng });
      }
    }
    if (r) {
      const parsedRadius = parseInt(r, 10);
      if (Number.isFinite(parsedRadius) && parsedRadius >= 100 && parsedRadius <= 5000) {
        setRadius(parsedRadius);
      }
    }
    if (cat !== null) {
      const validCategory = CATEGORIES.find(c => c.value === cat);
      if (validCategory) setCategory(cat);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tteulkka_favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ── 지도 초기화
  const initMap = useCallback(() => {
    if (mapInstance.current) { setMapReady(true); return; }
    if (!mapRef.current || !window.kakao?.maps?.Map) return;
    const map = new window.kakao.maps.Map(mapRef.current, {
      center: new window.kakao.maps.LatLng(37.5665, 126.9780),
      level: 5,
    });
    mapInstance.current = map;
    setMapReady(true);
    window.kakao.maps.event.addListener(map, 'click', (e: any) => {
      const pos = { lat: e.latLng.getLat(), lng: e.latLng.getLng() };
      if (compareModeRef.current && activePinRef.current === 'B') {
        setCenterB(pos);
      } else {
        setCenter(pos);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => window.kakao.maps.load(() => { if (!cancelled) initMap(); });
    if (window.kakao?.maps?.load) { load(); return () => { cancelled = true; }; }
    const t = setInterval(() => { if (window.kakao?.maps?.load) { clearInterval(t); load(); } }, 100);
    return () => { cancelled = true; clearInterval(t); };
  }, [initMap]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── 원 (A)
  useEffect(() => {
    if (!mapReady || !center) return;
    if (circleRef.current) circleRef.current.setMap(null);
    const c = new window.kakao.maps.Circle({
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      radius, strokeWeight: 2, strokeColor: '#3B82F6', strokeOpacity: 0.8,
      fillColor: '#3B82F6', fillOpacity: 0.08,
    });
    c.setMap(mapInstance.current);
    circleRef.current = c;
    mapInstance.current.panTo(new window.kakao.maps.LatLng(center.lat, center.lng));
  }, [center, radius, mapReady]);

  // ── 원 (B)
  useEffect(() => {
    if (!mapReady || !centerB || !compareMode) {
      if (circleRefB.current) { circleRefB.current.setMap(null); circleRefB.current = null; }
      return;
    }
    if (circleRefB.current) circleRefB.current.setMap(null);
    const c = new window.kakao.maps.Circle({
      center: new window.kakao.maps.LatLng(centerB.lat, centerB.lng),
      radius, strokeWeight: 2, strokeColor: '#F97316', strokeOpacity: 0.8,
      fillColor: '#F97316', fillOpacity: 0.08,
    });
    c.setMap(mapInstance.current);
    circleRefB.current = c;
  }, [centerB, radius, mapReady, compareMode]);

  // ── 현재 위치 점
  useEffect(() => {
    if (!mapReady || !currentLocation) return;
    if (currentLocationOverlayRef.current) currentLocationOverlayRef.current.setMap(null);
    const dot = document.createElement('div');
    dot.style.cssText = `width:18px;height:18px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5)`;
    const o = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng),
      content: dot, xAnchor: 0.5, yAnchor: 0.5,
    });
    o.setMap(mapInstance.current);
    currentLocationOverlayRef.current = o;
  }, [currentLocation, mapReady]);

  // ── 자동완성 debounce
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setShowResults(false); return; }
    const t = setTimeout(() => searchPlace(searchQuery, true), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── 마커 그리기
  const drawMarkers = useCallback((data: Store[], isB = false) => {
    const clusterRef = isB ? clustererBRef : clustererRef;
    if (clusterRef.current) {
      clusterRef.current.clear();
    } else {
      clusterRef.current = new window.kakao.maps.MarkerClusterer({
        map: mapInstance.current, averageCenter: true, minLevel: 4, minClusterSize: 2,
      });
    }
    const markers = data.map(store => {
      const m = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(store.lat, store.lng),
      });
      window.kakao.maps.event.addListener(m, 'click', () => setSelectedStore(store));
      return m;
    });
    clusterRef.current.addMarkers(markers);
  }, []);

  // ── 상권 검색 A
  const searchStores = useCallback(async () => {
    if (!center || !mapReady) return;
    const p = new URLSearchParams();
    p.set('lat', center.lat.toFixed(6)); p.set('lng', center.lng.toFixed(6));
    p.set('radius', String(radius));
    if (category) p.set('category', category);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });

    abortControllerRef.current?.abort();
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    const rid = ++requestIdRef.current;
    setLoading(true); setSelectedStore(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${apiBase}/api/stores?${new URLSearchParams({
        lat: String(center.lat), lng: String(center.lng),
        radius: String(radius), ...(category && { category }),
      })}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
      const data: Store[] = await res.json();
      if (rid !== requestIdRef.current) return;
      setStores(data); drawMarkers(data, false);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      showToast('서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (rid === requestIdRef.current) setLoading(false);
    }
  }, [center, radius, category, mapReady, drawMarkers, router, pathname, showToast]);

  // ── 상권 검색 B
  const searchStoresB = useCallback(async () => {
    if (!centerB || !mapReady) return;
    abortControllerBRef.current?.abort();
    const ctrl = new AbortController();
    abortControllerBRef.current = ctrl;
    const rid = ++requestIdBRef.current;
    setLoadingB(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${apiBase}/api/stores?${new URLSearchParams({
        lat: String(centerB.lat), lng: String(centerB.lng),
        radius: String(radius), ...(category && { category }),
      })}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
      const data: Store[] = await res.json();
      if (rid !== requestIdBRef.current) return;
      setStoresB(data); drawMarkers(data, true);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      showToast('B 지점 분석에 실패했어요.');
    } finally {
      if (rid === requestIdBRef.current) setLoadingB(false);
    }
  }, [centerB, radius, category, mapReady, drawMarkers, showToast]);

  // ── 자동 분석 (A)
  useEffect(() => {
    if (!center || !mapReady) return;
    const t = setTimeout(searchStores, 600);
    return () => clearTimeout(t);
  }, [searchStores]);

  // ── 자동 분석 (B)
  useEffect(() => {
    if (!centerB || !mapReady || !compareMode) return;
    const t = setTimeout(searchStoresB, 600);
    return () => clearTimeout(t);
  }, [searchStoresB, compareMode]);

  // ── 장소 검색
  const searchPlace = useCallback(async (query: string, silent = false) => {
    if (!query.trim()) return;
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      const data = await res.json();
      if (ctrl.signal.aborted) return;
      const results: any[] = data.documents ?? [];
      if (results.length > 0) { setSearchResults(results); setShowResults(true); }
      else { setSearchResults([]); setShowResults(false); if (!silent) alert('검색 결과가 없습니다.'); }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      if (!silent) alert('검색 중 오류가 발생했습니다.');
    }
  }, []);

  const selectSearchResult = useCallback((r: any) => {
    const pos = { lat: parseFloat(r.y), lng: parseFloat(r.x) };
    if (compareMode && activePin === 'B') setCenterB(pos);
    else setCenter(pos);
    setSearchQuery(r.place_name); setSearchResults([]); setShowResults(false);
  }, [compareMode, activePin]);

  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) { alert('이 브라우저는 위치 기능을 지원하지 않습니다.'); return; }
    const fallback = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const loc = { lat: data.latitude, lng: data.longitude };
          setCenter(loc); setCurrentLocation(loc);
        } else alert('위치를 확인할 수 없습니다.\n지도를 직접 클릭해 위치를 선택해주세요.');
      } catch { alert('위치를 확인할 수 없습니다.\n지도를 직접 클릭해 위치를 선택해주세요.'); }
    };
    navigator.geolocation.getCurrentPosition(
      pos => { const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCenter(loc); setCurrentLocation(loc); },
      async err => { if (err.code === 1) alert('위치 권한이 차단되어 있습니다.'); else await fallback(); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  // ── 즐겨찾기
  const saveFavorite = useCallback(() => {
    if (!center) return;
    const label = searchQuery.trim() || (stores.length > 0 ? getMostCommonDong(stores) : `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`);
    const newFav: Favorite = {
      id: Date.now().toString(), label,
      lat: center.lat, lng: center.lng,
      radius, category, total: stores.length,
      score: score?.overall,
    };
    const updated = [newFav, ...favorites].slice(0, 10);
    setFavorites(updated);
    localStorage.setItem('tteulkka_favorites', JSON.stringify(updated));
    showToast('즐겨찾기에 저장했습니다 ★');
  }, [center, radius, category, stores, score, favorites, searchQuery, showToast]);

  const loadFavorite = useCallback((fav: Favorite) => {
    setCenter({ lat: fav.lat, lng: fav.lng });
    setRadius(fav.radius); setCategory(fav.category);
    setShowFavorites(false);
    showToast(`"${fav.label}" 불러왔습니다`);
  }, [showToast]);

  const deleteFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    localStorage.setItem('tteulkka_favorites', JSON.stringify(updated));
  }, [favorites]);

  const shareUrl = useCallback(async () => {
    try { await navigator.clipboard.writeText(window.location.href); showToast('링크가 복사되었습니다!'); }
    catch { prompt('이 URL을 복사하세요:', window.location.href); }
  }, [showToast]);

  // ── 비교 모드 진입/종료
  const enterCompareMode = useCallback(() => {
    setCompareMode(true);
    setActivePin('A');
    setCompareTab('A');
    setMobileOpen(true);
  }, []);

  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setActivePin('A');
    setCenterB(null);
    setStoresB([]);
    if (clustererBRef.current) { clustererBRef.current.clear(); }
    if (circleRefB.current) { circleRefB.current.setMap(null); circleRefB.current = null; }
  }, []);

  const mobileTransform = isMobile
    ? (mobileOpen ? 'translateY(0)' : 'translateY(calc(100% - 64px))')
    : undefined;

  // ── 공통 패널 콘텐츠 렌더러
  const renderAnalysis = (
    storesData: Store[],
    scoreData: ReturnType<typeof computeScore>,
    statsData: ReturnType<typeof computeStats>,
    isLoading: boolean,
    pinColor: string,
  ) => {
    if (isLoading) return <div className="px-4 py-8 text-center text-sm text-gray-400">분석 중...</div>;
    if (!storesData.length) return <div className="px-4 py-8 text-center text-sm text-gray-400">위치를 선택하면<br />자동으로 분석됩니다</div>;
    const si = scoreData ? getScoreLabel(scoreData.overall) : null;
    return (
      <>
        {/* 점수 */}
        {scoreData && si && (
          <div className="px-4 py-3 border-b"
            style={{ background: `linear-gradient(135deg, ${si.color}08, ${si.color}18)` }}>
            <div className="flex items-end gap-3 mb-2">
              <div>
                <span className="text-3xl font-black" style={{ color: si.color }}>{scoreData.overall}</span>
                <span className="text-sm text-gray-500 ml-1">/ 100</span>
              </div>
              <span className="text-sm font-semibold mb-1" style={{ color: si.color }}>{si.label}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${scoreData.overall}%`, backgroundColor: si.color }} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: '다양성', value: scoreData.diversity, emoji: '🌈' },
                { label: '밀집도', value: scoreData.density, emoji: '📍' },
                { label: '균형도', value: scoreData.balance, emoji: '⚖️' },
              ].map(item => (
                <div key={item.label} className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-base">{item.emoji}</div>
                  <div className="text-xs font-bold text-gray-800">{item.value}</div>
                  <div className="text-xs text-gray-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 결과 수 */}
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b flex justify-between">
          <span>총 {storesData.length.toLocaleString()}개 업체</span>
          {storesData.length >= 300 && <span className="text-amber-600">300개 표시 중</span>}
        </div>
        {/* 업종 분포 */}
        {statsData && (
          <div className="px-4 py-3 border-b space-y-1.5">
            {statsData.sorted.map(([label, count]) => {
              const cat = CATEGORIES.find(c => c.label === label);
              const color = CATEGORY_COLORS[cat?.value ?? '기타'] ?? '#9CA3AF';
              const pct = Math.round((count / statsData.total) * 100);
              const w = Math.round((count / statsData.maxCount) * 100);
              return (
                <div key={label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-gray-700">{cat?.emoji ?? '🏪'} {label}</span>
                    <span className="text-xs tabular-nums text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* 업체 목록 */}
        <div className="md:overflow-y-auto md:flex-1 md:min-h-0">
          {storesData.slice(0, 50).map(store => {
            const cat = CATEGORIES.find(c => c.value && store.categoryCode.startsWith(c.value));
            const color = CATEGORY_COLORS[cat?.value ?? '기타'] ?? '#9CA3AF';
            return (
              <div key={store.id} onClick={() => setSelectedStore(store)}
                className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedStore?.id === store.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                <div className="font-medium text-sm text-gray-900 truncate">{store.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-500">{store.categoryName}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400 truncate">{store.dong}</span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapRef} className="absolute inset-0" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <p className="text-gray-400 text-sm">지도 로딩 중...</p>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── 즐겨찾기 모달 ── */}
      {showFavorites && (
        <div className="absolute inset-0 z-40 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setShowFavorites(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-bold text-gray-900">즐겨찾기</span>
              <button onClick={() => setShowFavorites(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {/* 탭 */}
            <div className="flex border-b">
              {(['list', 'compare'] as const).map(t => (
                <button key={t} onClick={() => setFavTab(t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${favTab === t ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400'}`}>
                  {t === 'list' ? '목록' : '비교표'}
                </button>
              ))}
            </div>

            {favTab === 'list' ? (
              favorites.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  저장된 즐겨찾기가 없습니다.<br />상권 검색 후 ★ 버튼으로 저장하세요.
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto divide-y">
                  {favorites.map(fav => (
                    <li key={fav.id} onClick={() => loadFavorite(fav)}
                      className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{fav.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          반경 {fav.radius >= 1000 ? `${fav.radius / 1000}km` : `${fav.radius}m`}
                          {fav.category ? ` · ${CATEGORIES.find(c => c.value === fav.category)?.label}` : ''}
                          {fav.total > 0 ? ` · ${fav.total}개` : ''}
                        </div>
                      </div>
                      {fav.score !== undefined && (
                        <span className="mx-2 text-sm font-bold flex-shrink-0" style={{ color: getScoreLabel(fav.score).color }}>
                          {fav.score}점
                        </span>
                      )}
                      <button onClick={e => deleteFavorite(fav.id, e)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">✕</button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              /* 비교표 */
              favorites.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  즐겨찾기를 먼저 저장하세요.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">지역</th>
                        <th className="px-2 py-2 text-center text-gray-500 font-medium">반경</th>
                        <th className="px-2 py-2 text-center text-gray-500 font-medium">업체수</th>
                        <th className="px-2 py-2 text-center text-gray-500 font-medium">점수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y max-h-72 overflow-y-auto">
                      {[...favorites]
                        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                        .map((fav, i) => {
                          const si = fav.score !== undefined ? getScoreLabel(fav.score) : null;
                          return (
                            <tr key={fav.id} onClick={() => loadFavorite(fav)}
                              className="cursor-pointer hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {i === 0 && <span className="text-yellow-400">👑</span>}
                                  <span className="font-medium text-gray-800 truncate max-w-[80px]">{fav.label}</span>
                                </div>
                                {fav.category && (
                                  <div className="text-gray-400 mt-0.5">
                                    {CATEGORIES.find(c => c.value === fav.category)?.emoji} {CATEGORIES.find(c => c.value === fav.category)?.label}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-center text-gray-500">
                                {fav.radius >= 1000 ? `${fav.radius / 1000}km` : `${fav.radius}m`}
                              </td>
                              <td className="px-2 py-2.5 text-center text-gray-700 font-medium">
                                {fav.total.toLocaleString()}
                              </td>
                              <td className="px-2 py-2.5 text-center">
                                {si ? (
                                  <span className="font-bold" style={{ color: si.color }}>{fav.score}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── 모바일 FAB ── */}
      <div className="md:hidden absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button onClick={getCurrentLocation}
          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-lg hover:bg-blue-50">📍</button>
        <button onClick={() => setShowFavorites(true)}
          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-yellow-400 hover:bg-yellow-50 text-lg">★</button>
        <button onClick={shareUrl}
          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
        </button>
        {!compareMode ? (
          <button onClick={enterCompareMode}
            className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-purple-500 hover:bg-purple-50 text-sm font-bold">A↔B</button>
        ) : (
          <button onClick={exitCompareMode}
            className="w-10 h-10 bg-purple-500 rounded-xl shadow-lg flex items-center justify-center text-white text-sm font-bold">✕</button>
        )}
      </div>

      {/* ── 메인 패널 ── */}
      <div
        className="absolute z-10 left-0 right-0 bottom-0 flex flex-col md:left-3 md:right-auto md:top-3 md:bottom-3 md:w-80 md:overflow-hidden md:gap-2"
        style={{
          transform: mobileTransform,
          transition: 'transform 0.3s ease',
          ...(isMobile ? { maxHeight: '85vh' } : {}),
        }}
      >
        {/* 모바일 핸들 */}
        <div className="md:hidden bg-white rounded-t-2xl shadow-xl flex-shrink-0 cursor-pointer select-none"
          onClick={() => setMobileOpen(p => !p)}>
          <div className="pt-2.5 pb-1 flex justify-center">
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="px-4 pb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {compareMode
                ? `A: ${score ? score.overall + '점' : '미설정'} | B: ${scoreB ? scoreB.overall + '점' : '미설정'}`
                : loading ? '분석 중...'
                  : stores.length > 0 ? `총 ${stores.length.toLocaleString()}개 업체`
                    : center ? '분석 준비됨' : '지도를 탭해 위치 선택'}
            </span>
            {!compareMode && scoreInfo && score ? (
              <span className="text-sm font-bold" style={{ color: scoreInfo.color }}>
                {scoreInfo.label} {score.overall}점
              </span>
            ) : (
              <span className="text-xs text-gray-400">{mobileOpen ? '닫기 ▾' : '열기 ▴'}</span>
            )}
          </div>
        </div>

        {/* 모바일: 핸들 아래 스크롤 래퍼 / 데스크톱: display:contents 로 투명 처리 */}
        <div
          className="md:contents flex-1 min-h-0 flex flex-col"
          style={isMobile ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties : {}}
        >

          {/* ── 컨트롤 카드 ── */}
          <div className="bg-white border-t md:border-t-0 md:rounded-2xl md:shadow-xl flex-shrink-0">
            {/* 헤더 (데스크톱) */}
            <div className="hidden md:flex px-4 pt-3 pb-2 items-center justify-between">
              <div>
                <h1 className="text-base font-bold text-gray-900">뜰까 🗺️</h1>
                <p className="text-xs text-gray-400">지도 클릭 또는 검색으로 위치 선택</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setShowFavorites(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-yellow-50 text-gray-400 hover:text-yellow-500 text-base">★</button>
                <button onClick={shareUrl}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                </button>
                <button onClick={() => setBizMode(p => !p)}
                  className={`px-2 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    bizMode ? 'bg-green-100 text-green-600' : 'bg-gray-50 hover:bg-green-50 text-gray-400 hover:text-green-500'
                  }`}>🏪창업</button>
                {!compareMode ? (
                  <button onClick={enterCompareMode}
                    className="px-2 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-purple-50 text-gray-400 hover:text-purple-500 text-xs font-bold">A↔B</button>
                ) : (
                  <button onClick={exitCompareMode}
                    className="px-2 h-8 flex items-center justify-center rounded-lg bg-purple-100 text-purple-600 text-xs font-bold">비교 종료</button>
                )}
              </div>
            </div>

            <div className="px-4 py-4 space-y-3">
              {/* 비교 모드: 핀 선택 */}
              {compareMode && (
                <div className="flex gap-2">
                  {(['A', 'B'] as const).map(pin => (
                    <button key={pin} onClick={() => setActivePin(pin)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${activePin === pin
                        ? pin === 'A' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {pin === 'A' ? '🔵' : '🟠'} {pin} 위치 설정
                    </button>
                  ))}
                </div>
              )}

              {/* 검색 */}
              <div className="relative" ref={searchRef}>
                <div className="flex gap-1.5">
                  <input type="text" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchPlace(searchQuery)}
                    placeholder={compareMode ? `${activePin} 위치 검색` : '장소 또는 주소 검색'}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white text-gray-900 placeholder-gray-400" />
                  <button onClick={() => searchPlace(searchQuery)}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">검색</button>
                </div>
                {showResults && searchResults.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {searchResults.map((r, i) => (
                      <li key={i} onClick={() => selectSearchResult(r)}
                        className="px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b last:border-b-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{r.place_name}</div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">{r.address_name}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 현재 위치 */}
              {!compareMode && (
                <button onClick={getCurrentLocation}
                  className="w-full py-2 px-3 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                  📍 현재 위치 사용
                </button>
              )}

              {/* 반경 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-700">반경{compareMode && ' (A·B 공통)'}</label>
                  <span className="text-xs text-blue-600 font-semibold">
                    {radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}
                  </span>
                </div>
                <input type="range" min={100} max={5000} step={100} value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>100m</span><span>5km</span>
                </div>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">카테고리</label>
                <div className="flex flex-wrap gap-1">
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setCategory(c.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${category === c.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 분석 버튼 */}
              {!compareMode && (
                <button onClick={searchStores}
                  disabled={!center || !mapReady || loading}
                  className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {loading ? '분석 중...' : center ? (stores.length ? '다시 분석' : '상권 분석하기') : '위치를 선택해주세요'}
                </button>
              )}
            </div>
          </div>

          {/* ── 결과 카드 ── */}
          {(stores.length > 0 || compareMode) && (
            <div className="bg-white border-t md:border-t-0 md:rounded-2xl md:shadow-xl md:flex-1 md:min-h-0 flex flex-col md:overflow-hidden">

              {compareMode ? (
                /* ── 두 지역 비교 ── */
                <>
                  {/* 빠른 비교 요약 */}
                  <div className="grid grid-cols-2 divide-x border-b flex-shrink-0">
                    {[
                      { label: 'A', s: score, si: scoreInfo, count: stores.length, loading, color: '#3B82F6' },
                      { label: 'B', s: scoreB, si: scoreInfoB, count: storesB.length, loading: loadingB, color: '#F97316' },
                    ].map(({ label, s, si, count, loading: ld, color }) => (
                      <div key={label} className="px-3 py-3 text-center">
                        <div className="text-xs font-bold mb-1" style={{ color }}>
                          {label === 'A' ? '🔵' : '🟠'} {label === 'A' ? labelA : labelB}
                        </div>
                        {ld ? (
                          <div className="text-xs text-gray-400">분석 중...</div>
                        ) : s && si ? (
                          <>
                            <div className="text-2xl font-black" style={{ color: si.color }}>{s.overall}</div>
                            <div className="text-xs font-semibold" style={{ color: si.color }}>{si.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{count}개 업체</div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400 mt-2">
                            {label === 'A' ? '위치 설정 필요' : '🟠 B 위치를 지도에서 선택'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* A/B 탭 상세 */}
                  <div className="flex border-b flex-shrink-0">
                    {(['A', 'B'] as const).map(t => (
                      <button key={t} onClick={() => setCompareTab(t)}
                        className={`flex-1 py-2 text-xs font-semibold transition-colors ${compareTab === t
                          ? t === 'A' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-orange-500 border-b-2 border-orange-500'
                          : 'text-gray-400'}`}>
                        {t === 'A' ? '🔵' : '🟠'} {t} 상세
                      </button>
                    ))}
                  </div>
                  <div className="md:overflow-y-auto md:flex-1">
                    {compareTab === 'A'
                      ? renderAnalysis(stores, score, stats, loading, '#3B82F6')
                      : renderAnalysis(storesB, scoreB, statsB, loadingB, '#F97316')}
                  </div>
                </>
              ) : (
                /* ── 일반 분석 ── */
                <>
                  {/* 결과 탭 */}
                  <div className="flex border-b flex-shrink-0">
                    {([
                      { key: 'analysis' as const, label: '분석' },
                      { key: 'list' as const, label: `업체 목록 ${stores.length > 0 ? `(${stores.length})` : ''}` },
                      ...(bizMode ? [{ key: 'biz' as const, label: '🏪 창업' }] : []),
                    ]).map(({ key, label }) => (
                      <button key={key} onClick={() => setResultTab(key)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          resultTab === key
                            ? key === 'biz' ? 'text-green-600 border-b-2 border-green-500' : 'text-blue-600 border-b-2 border-blue-500'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {resultTab === 'biz' ? (
                    /* ── 창업 계획 탭 ── */
                    <div className="md:overflow-y-auto md:flex-1 md:min-h-0 px-4 py-4 space-y-5">
                      <p className="text-xs text-gray-400">참고용 분석 · 실제 시장 상황과 다를 수 있습니다</p>

                      {/* 업종 선택 */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1.5">창업 업종</label>
                        <div className="flex flex-wrap gap-1">
                          {CATEGORIES.filter(c => c.value).map(c => (
                            <button key={c.value} onClick={() => setCategory(c.value)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                category === c.value ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}>
                              {c.emoji} {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 총 창업 비용 */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">총 창업 비용 (만원)</label>
                        <input type="text" inputMode="numeric"
                          value={bizPlan.totalBudget}
                          onChange={e => setBizPlan(p => ({ ...p, totalBudget: e.target.value.replace(/[^0-9]/g, '') }))}
                          placeholder="예: 5000"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 bg-white text-gray-900 placeholder-gray-400" />
                        {category && BIZ_COST_REFERENCE[category] && (
                          <p className="text-xs text-gray-400 mt-1">
                            {CATEGORIES.find(c => c.value === category)?.label} 평균:{' '}
                            {BIZ_COST_REFERENCE[category].min.toLocaleString()}~{BIZ_COST_REFERENCE[category].max.toLocaleString()}만원
                            <span className="text-gray-300 ml-1">(소상공인진흥공단 참고)</span>
                          </p>
                        )}
                      </div>

                      {/* 월 임대료 예산 */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">월 임대료 예산 (만원)</label>
                        <input type="text" inputMode="numeric"
                          value={bizPlan.monthlyRent}
                          onChange={e => setBizPlan(p => ({ ...p, monthlyRent: e.target.value.replace(/[^0-9]/g, '') }))}
                          placeholder="예: 100"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 bg-white text-gray-900 placeholder-gray-400" />
                        {stores.length > 0 && score && (
                          <p className="text-xs text-gray-400 mt-1">
                            이 상권 추정 임대료: 약 {
                              score.overall >= 80 ? 250 : score.overall >= 65 ? 150 : score.overall >= 45 ? 80 : 40
                            }만원/월
                          </p>
                        )}
                      </div>

                      {/* 메모 */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">메모 (선택)</label>
                        <textarea
                          value={bizPlan.memo}
                          onChange={e => setBizPlan(p => ({ ...p, memo: e.target.value }))}
                          placeholder="컨셉, 타겟 고객, 특이사항 등 자유롭게..."
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 bg-white text-gray-900 placeholder-gray-400 resize-none" />
                      </div>

                      {/* 창업 적합도 결과 */}
                      {bizScore ? (
                        <div className="rounded-xl bg-green-50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">창업 적합도</span>
                            <span className="text-xs font-bold" style={{ color: getBizScoreColor(bizScore.overall) }}>
                              {getBizScoreLabel(bizScore.overall)}
                            </span>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="text-3xl font-black" style={{ color: getBizScoreColor(bizScore.overall) }}>
                              {bizScore.overall}
                            </span>
                            <span className="text-sm text-gray-400 mb-1">/ 100</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all duration-500"
                              style={{ width: `${bizScore.overall}%`, backgroundColor: getBizScoreColor(bizScore.overall) }} />
                          </div>
                          <div className="space-y-2 pt-1">
                            {[
                              { label: '경쟁 환경', value: bizScore.compScore, note: competition?.saturation.label ?? (category ? '분석 중' : '업종 미선택') },
                              { label: '예산 충분도', value: bizScore.budgetScore, note: bizPlan.totalBudget ? `${Number(bizPlan.totalBudget).toLocaleString()}만원` : '미입력' },
                              { label: '임대료 부담', value: bizScore.rentScore, note: bizPlan.monthlyRent ? `${Number(bizPlan.monthlyRent).toLocaleString()}만원 예산` : '미입력' },
                            ].map(item => (
                              <div key={item.label}>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-xs font-medium text-gray-700">{item.label}</span>
                                  <span className="text-xs text-gray-400">{item.note}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full"
                                    style={{
                                      width: `${item.value}%`,
                                      backgroundColor: item.value >= 70 ? '#10B981' : item.value >= 40 ? '#F59E0B' : '#EF4444',
                                    }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          {bizPlan.memo && (
                            <div className="pt-2 border-t border-green-100">
                              <p className="text-xs text-gray-500 whitespace-pre-wrap">{bizPlan.memo}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-gray-50 p-4 text-center">
                          <p className="text-xs text-gray-400">상권 분석 후 창업 적합도가 표시됩니다</p>
                          <p className="text-xs text-gray-300 mt-1">지도에서 위치를 선택하고 분석하기를 눌러주세요</p>
                        </div>
                      )}
                    </div>
                  ) : resultTab === 'analysis' ? (
                    /* ── 분석 탭 ── */
                    <div className="md:overflow-y-auto md:flex-1 md:min-h-0">

                      {/* 상권 종합 점수 */}
                      {score && scoreInfo && (
                        <div className="px-4 py-3 border-b"
                          style={{ background: `linear-gradient(135deg, ${scoreInfo.color}08, ${scoreInfo.color}18)` }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-700">상권 종합 점수</span>
                            <button onClick={saveFavorite}
                              className="text-sm text-yellow-400 hover:text-yellow-500">★ 저장</button>
                          </div>
                          <div className="flex items-end gap-3 mb-2">
                            <div>
                              <span className="text-3xl font-black" style={{ color: scoreInfo.color }}>{score.overall}</span>
                              <span className="text-sm text-gray-500 ml-1">/ 100</span>
                            </div>
                            <span className="text-sm font-semibold mb-1" style={{ color: scoreInfo.color }}>{scoreInfo.label}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                            <div className="h-2 rounded-full transition-all duration-500"
                              style={{ width: `${score.overall}%`, backgroundColor: scoreInfo.color }} />
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { label: '다양성', value: score.diversity, emoji: '🌈' },
                              { label: '밀집도', value: score.density, emoji: '📍' },
                              { label: '균형도', value: score.balance, emoji: '⚖️' },
                            ].map(item => (
                              <div key={item.label} className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
                                <div className="text-base">{item.emoji}</div>
                                <div className="text-xs font-bold text-gray-800">{item.value}</div>
                                <div className="text-xs text-gray-400">{item.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 업종 분포 */}
                      {stats && (
                        <div className="px-4 py-3 border-b space-y-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">업종 분포</span>
                            {stats.selectedCount !== null && (
                              <span className="text-xs text-blue-600 font-medium">
                                {stats.selectedLabel} {stats.selectedCount}개 ({Math.round((stats.selectedCount / stats.total) * 100)}%)
                              </span>
                            )}
                          </div>
                          {stats.sorted.map(([label, count]) => {
                            const cat = CATEGORIES.find(c => c.label === label);
                            const color = CATEGORY_COLORS[cat?.value ?? '기타'] ?? '#9CA3AF';
                            const isSelected = label === stats.selectedLabel;
                            const pct = Math.round((count / stats.total) * 100);
                            const w = Math.round((count / stats.maxCount) * 100);
                            return (
                              <div key={label} className={`rounded-lg px-2 py-1 ${isSelected ? 'bg-blue-50' : ''}`}>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-xs font-medium text-gray-700">{cat?.emoji ?? '🏪'} {label}</span>
                                  <span className="text-xs tabular-nums text-gray-400">{count} ({pct}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${w}%`, backgroundColor: isSelected ? '#3B82F6' : color }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 경쟁 분석 — 업종 선택 시 인라인 표시 */}
                      <div className="px-4 py-4 space-y-4">
                        {!category ? (
                          <div className="text-center py-3">
                            <p className="text-xs text-gray-400">위 카테고리에서 업종을 선택하면</p>
                            <p className="text-xs font-medium text-gray-600 mt-0.5">경쟁 포화도를 분석합니다</p>
                          </div>
                        ) : competition ? (
                          <>
                            {/* 포화도 메인 카드 */}
                            <div className="rounded-xl p-4 text-center"
                              style={{ background: `${competition.saturation.color}10`, border: `1px solid ${competition.saturation.color}30` }}>
                              <div className="text-xs text-gray-500 mb-1">
                                {CATEGORIES.find(c => c.value === category)?.emoji} {CATEGORIES.find(c => c.value === category)?.label} 경쟁 포화도
                              </div>
                              <div className="text-2xl font-black mb-1" style={{ color: competition.saturation.color }}>
                                {competition.saturation.label}
                              </div>
                              <div className="text-xs text-gray-500">{competition.saturation.desc}</div>
                              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                                <div>
                                  <div className="text-xl font-bold text-gray-800">{competition.catCount}</div>
                                  <div className="text-xs text-gray-400">경쟁 업체 수</div>
                                </div>
                                <div>
                                  <div className="text-xl font-bold text-gray-800">{competition.perKm2}</div>
                                  <div className="text-xs text-gray-400">개/km²</div>
                                </div>
                              </div>
                            </div>

                            {/* 포화도 기준 범례 */}
                            <div>
                              <div className="text-xs font-semibold text-gray-700 mb-2">포화도 기준</div>
                              <div className="space-y-1.5">
                                {[
                                  { label: '포화', range: '80↑ /km²', color: '#EF4444' },
                                  { label: '경쟁 심화', range: '40–80', color: '#F97316' },
                                  { label: '적정 경쟁', range: '15–40', color: '#10B981' },
                                  { label: '기회', range: '15↓', color: '#3B82F6' },
                                ].map(r => (
                                  <div key={r.label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${competition.saturation.label === r.label ? 'bg-gray-100 font-semibold' : ''}`}>
                                    <span className="text-xs" style={{ color: r.color }}>● {r.label}</span>
                                    <span className="text-xs text-gray-400">{r.range}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 기회 업종 */}
                            {competition.opportunities.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">이 상권의 틈새 업종</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {competition.opportunities.map(op => (
                                    <button key={op.value} onClick={() => setCategory(op.value)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                                      {op.emoji} {op.label}
                                      <span className="text-blue-400 text-xs">경쟁 적음</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 전체 업종 경쟁 현황 */}
                            {score && (
                              <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">전체 업종 경쟁 현황</div>
                                <div className="space-y-1.5">
                                  {CATEGORIES.filter(c => c.value).map(c => {
                                    const cnt = score.catCounts.get(c.value) ?? 0;
                                    const pkm = cnt / score.areaKm2;
                                    const sat = getSaturation(pkm);
                                    const isActive = c.value === category;
                                    return (
                                      <button key={c.value} onClick={() => setCategory(c.value)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                        <span className="text-base flex-shrink-0">{c.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-gray-700">{c.label}</span>
                                            <span className="text-xs font-semibold" style={{ color: sat.color }}>{sat.label}</span>
                                          </div>
                                          <div className="text-xs text-gray-400">{cnt}개 ({Math.round(pkm * 10) / 10}/km²)</div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-4 text-sm text-gray-400">분석 중...</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ── 업체 목록 탭 ── */
                    <div className="md:overflow-y-auto md:flex-1 md:min-h-0">
                      <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b flex justify-between sticky top-0">
                        <span>총 {stores.length.toLocaleString()}개 업체</span>
                        {stores.length >= 300 && <span className="text-amber-600">300개 표시 중</span>}
                      </div>
                      {stores.map(store => {
                        const cat = CATEGORIES.find(c => c.value && store.categoryCode.startsWith(c.value));
                        const color = CATEGORY_COLORS[cat?.value ?? '기타'] ?? '#9CA3AF';
                        return (
                          <div key={store.id} onClick={() => setSelectedStore(store)}
                            className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedStore?.id === store.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                            <div className="font-medium text-sm text-gray-900 truncate">{store.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: color }} />
                              <span className="text-xs text-gray-500">{store.categoryName}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400 truncate">{store.dong}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>{/* 스크롤 래퍼 끝 */}
      </div>{/* 메인 패널 끝 */}

      {/* ── 선택된 상점 카드 ── */}
      {selectedStore && (
        <div className="absolute bottom-20 md:bottom-4 left-3 md:left-[340px] right-4 z-10 bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-bold text-base text-gray-900 truncate">{selectedStore.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {(() => {
                    const cat = CATEGORIES.find(c => c.value && selectedStore.categoryCode.startsWith(c.value));
                    const color = CATEGORY_COLORS[cat?.value ?? '기타'] ?? '#9CA3AF';
                    return (
                      <>
                        <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: color }} />
                        <span className="text-xs text-gray-500">{selectedStore.categoryName}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => setSelectedStore(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-1.5 mb-4">
              <div className="flex gap-2">
                <span className="text-gray-400 w-7 flex-shrink-0 text-xs pt-0.5">주소</span>
                <span className="text-gray-700 text-xs leading-relaxed">{selectedStore.address}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-7 flex-shrink-0 text-xs pt-0.5">지역</span>
                <span className="text-gray-700 text-xs">{selectedStore.sido} {selectedStore.sigungu} {selectedStore.dong}</span>
              </div>
            </div>
            <a href={`https://map.kakao.com/?q=${encodeURIComponent(selectedStore.name + ' ' + selectedStore.dong)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-yellow-400 text-yellow-900 rounded-xl text-sm font-semibold hover:bg-yellow-500 transition-colors">
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
