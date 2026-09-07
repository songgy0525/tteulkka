import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get('query');
    if (!query?.trim()) {
        return NextResponse.json({ documents: [] });
    }

    const signal = AbortSignal.timeout(5_000);

    try {
        const res = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
            {
                headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
                signal,
            }
        );
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch {
        if (signal.aborted) {
            return NextResponse.json({ error: 'upstream timeout' }, { status: 504 });
        }
        return NextResponse.json({ error: 'internal server error' }, { status: 500 });
    }
}
