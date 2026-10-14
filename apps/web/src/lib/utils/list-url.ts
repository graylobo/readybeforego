/**
 * 목록 화면의 주소 값(?page=, ?tab= 등). 페이지 번호·탭을 주소에 두어야 글을 보다가 뒤로가기 했을 때 보던 곳으로 돌아온다.
 */

/** 주소의 페이지 번호 (없거나 잘못되면 1). 서버 렌더링과 화면이 같은 규칙이어야 첫 화면 데이터를 그대로 쓴다 */
export function parsePageParam(value: string | null | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * 지금 주소의 값만 바꿔 기록에 남긴다 (null이면 지움). Next 라우터와 연동되는 pushState라
 * 서버를 다시 부르지 않고 주소와 useSearchParams만 바뀐다. 브라우저에서만 호출한다
 */
export function pushSearchParams(updates: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.pushState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}
