import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SITE_CONFIG } from '@/lib/constants';
import { CATEGORY_MAP, parseCategories } from '@/lib/constants/scam-categories';
import { destinationPath, findDestination, sortByCardOrder, type Destination } from '@/lib/destinations';
import type { City, Region, ScamInfo } from '@/lib/api/scams';

// 처음 요청 때 그려 저장하고 10분마다 새로 받는다 (방문이 늘어도 API를 매번 부르지 않게)
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ country: string; city: string }> };

async function getApi<T>(path: string): Promise<T> {
  const res = await fetch(`${SITE_CONFIG.apiUrl}${path}`, { next: { revalidate } });
  // 오류를 그대로 던져 실패한 화면이 저장되지 않게 한다
  if (!res.ok) throw new Error(`API ${path} 응답 ${res.status}`);
  return (await res.json()).data as T;
}

async function loadCityGuide(destination: Destination) {
  const cities = await getApi<City[]>(`/scams/cities/${destination.countryCode}`);
  const city = cities.find((c) => c.nameEn === destination.cityNameEn);
  if (!city) return null;
  const [scams, regions] = await Promise.all([
    getApi<ScamInfo[]>(`/scams/city/${city.id}`),
    getApi<Region[]>(`/scams/regions/${city.id}`),
  ]);
  const cautions = scams.filter((scam) => (scam.reportType ?? 'CAUTION') === 'CAUTION');
  return { cards: sortByCardOrder(cautions, destination.cards), regions };
}

function pageTitle(cityName: string) {
  return `${cityName} 여행 사기·호객 주의사항`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, city } = await params;
  const destination = findDestination(country, city);
  if (!destination) return {};
  const title = pageTitle(destination.cityName);
  const description = `${destination.cityName}에서 여행자가 자주 겪는 호객과 사기, 알아채는 신호와 대처법을 여행 전에 확인하세요.`;
  const path = destinationPath(destination);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
  };
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(value));

const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

export default async function DestinationPage({ params }: Props) {
  const { country, city } = await params;
  const destination = findDestination(country, city);
  if (!destination) notFound();
  const guide = await loadCityGuide(destination);
  if (!guide) notFound();

  const { cards, regions } = guide;
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const placeOf = (scam: ScamInfo) => {
    if (scam.scope === 'country') return '전국';
    if (scam.scope === 'city') return `${destination.cityName} 전역`;
    return scam.subLocation || (scam.regionId && regionById.get(scam.regionId)?.name) || destination.cityName;
  };
  const cardRegions = regions.filter((region) => cards.some((scam) => scam.regionId === region.id));

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{pageTitle(destination.cityName)}</h1>
        <p className="text-muted-foreground">
          {destination.cityName}에 가기 전에 알아두면 좋은 주의사항 {cards.length}가지입니다. 모든 제안이 사기는 아니지만, 아래 신호가 보이면 한 번 더 확인하세요.
        </p>
      </header>

      {cards.length > 0 && (
        <nav aria-label="주의사항 목록" className="rounded-xl border border-border p-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {cards.map((scam) => (
              <li key={scam.id}>
                <a href={`#${scam.id}`} className="underline-offset-4 hover:underline">{scam.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="space-y-4">
        {cards.map((scam) => {
          const host = scam.sourceUrl ? sourceHost(scam.sourceUrl) : null;
          return (
            <section key={scam.id} id={scam.id} className="scroll-mt-20 space-y-3 rounded-xl border border-border p-5">
              <div className="flex flex-wrap items-center gap-2">
                {parseCategories(scam.scamCategory).map((category) => (
                  <Badge key={category} variant="outline" className={CATEGORY_MAP[category]?.color}>
                    {CATEGORY_MAP[category]?.label ?? category}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">{placeOf(scam)}</span>
              </div>
              <h2 className="text-lg font-semibold leading-snug">{scam.title}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed">{scam.description}</p>
              {scam.avoidanceTip && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                  <strong className="font-semibold">대처: </strong>
                  {scam.avoidanceTip}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                내용 수정 {formatDate(scam.updatedAt)}
                {host && (
                  <>
                    {' · 출처 '}
                    <a href={scam.sourceUrl!} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                      {host}
                    </a>
                  </>
                )}
              </p>
            </section>
          );
        })}
      </div>

      {cardRegions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">지도에서 위치 보기</h2>
          <div className="flex flex-wrap gap-2">
            {cardRegions.map((region) => (
              <Link key={region.id} href={`/?regionId=${region.id}`} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent">
                {region.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">{destination.cityName}에서 겪은 일이 있나요?</h2>
        <p className="text-sm text-muted-foreground">
          다른 여행자에게 도움이 되도록 알려 주세요. 특정 업체나 개인을 지목하기보다 어떤 일을 겪었는지 적어 주시면 좋습니다.
        </p>
        <Link href="/" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          지도에서 제보하기
        </Link>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        여행자 경험과 공개 자료를 바탕으로 정리한 안내이며, 법률 자문이 아닙니다. 현지 규정과 상황은 바뀔 수 있으니 출국 전에 공식 안내를 확인하세요.
      </p>
    </article>
  );
}
