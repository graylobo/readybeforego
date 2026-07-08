# 실시간 알림 시스템 아키텍처 가이드 (SSE & HttpOnly Cookie)

이 문서는 본 프로젝트에 적용된 **실시간 알림 시스템**의 설계 원리와 기술적 구조를 상세히 설명합니다. 이 시스템은 현대적인 대규모 커뮤니티 플랫폼에서 사용하는 표준 기술 스택을 기반으로 설계되었습니다.

---

## 1. 핵심 기술 스택
- **SSE (Server-Sent Events)**: 서버에서 클라이언트로 실시간 데이터를 푸시하는 단방향 통신 기술입니다. 웹소켓(WebSocket)보다 가볍고 HTTP 표준을 따르며, 자동 재연결 기능이 내장되어 있어 알림 시스템에 최적입니다.
- **HttpOnly Cookie**: 자바스크립트가 접근할 수 없는 보안 쿠키를 통해 인증 토큰을 관리합니다. XSS 공격으로부터 안전하며, `EventSource`(SSE)의 인증 문제를 해결하는 핵심 열쇠입니다.
- **RxJS Subject**: 서버 내부에서 발생하는 알림 이벤트를 관리하고 발행하기 위한 이벤트 버스입니다.
- **React Query**: 서버의 알림 데이터를 캐싱하고, 실시간 신호가 오면 메모리를 무효화(Invalidate)하여 UI를 동적으로 업데이트합니다.

---

## 2. 알림 시스템 아키텍처 흐름도

```text
[ 유저 A ] -> [ 서버 (API) ] -> [ DB 저장 ] -> [ RxJS Stream ]
                                                  |
                                                  v
[ 유저 B ] <- [ SSE Connection ] <---------- [ 필터링 (UserID) ]
   |
   +--> [ React Query Invalidation ] -> [ UI 즉시 업데이트 ]
```

---

## 3. 핵심 코드 분석

### 3.1 서버측: 이벤트 발행 (Backend)
알림이 생성되면 데이터베이스에 저장함과 동시에, 서버 메모리에 떠 있는 '이벤트 상자(Subject)'에 신호를 넣습니다.

```typescript
// notifications.service.ts
@Injectable()
export class NotificationsService {
  // 모든 알림이 통과하는 서버 내부 통로
  private readonly notificationStream = new Subject<any>();

  async create(data: CreateNotificationDto) {
    // 1. DB 저장
    const created = await this.db.insert(notifications).values(data).returning();
    
    // 2. 실시간 스트림에 흘려보냄
    if (created?.[0]) {
      this.notificationStream.next(created[0]);
    }
    return created;
  }

  // SSE 컨트롤러가 구독하는 메서드
  getEventStream() {
    return this.notificationStream.asObservable();
  }
}
```

### 3.2 서버측: 실시간 연결 통로 (Controller)
사용자별로 각자의 통로를 열어두고, 본인에게 해당하는 알림만 필터링해서 보내줍니다.

```typescript
// notifications.controller.ts
@Sse('sse')
sse(@Req() req: any): Observable<MessageEvent> {
  const userId = req.user.id;
  
  return this.notificationsService.getEventStream().pipe(
    // 1. 전체 스트림 중 '로그인한 사용자'의 알림만 통과시킴
    filter((notification) => notification.userId === userId),
    // 2. 브라우저가 이해할 수 있는 SSE 형식으로 변환
    map((notification) => ({
      data: notification,
    } as MessageEvent))
  );
}
```

### 3.3 클라이언트측: 실시간 수신 및 UI 갱신 (Frontend)
브라우저는 서버와 파이프를 연결하고, 신호가 올 때마다 데이터를 새로 요청합니다.

```typescript
// use-notification-queries.ts
export const useNotificationSSE = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // HttpOnly 쿠키 덕분에 별도의 토큰 연산 없이 연결 성공
    const eventSource = new EventSource(`${API_URL}/notifications/sse`, { 
      withCredentials: true 
    });

    eventSource.onmessage = (event) => {
      // 서버에서 "새 알림 왔어!"라고 하면 리액트 쿼리에 알림 리스트 갱신 명령
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    return () => eventSource.close(); // 컴포넌트 언마운트 시 연결 해제 (자원 아끼기)
  }, [enabled, queryClient]);
};
```

---

## 4. 보안 및 인증 전략 (HttpOnly Cookie)
가장 중요한 포인트입니다. `EventSource` API는 자바스크립트로 요청 헤더를 수정할 수 없습니다.

- **문제**: `Authorization: Bearer <TOKEN>` 헤더를 보낼 수 없음.
- **해결**: 서버가 로그인을 시켜줄 때 `access_token`을 **HttpOnly 쿠키**에 담아 보냅니다.
- **결과**: 브라우저가 `EventSource` 연결을 시도할 때, 우리가 명령하지 않아도 **브라우저가 알아서 쿠키 주머니에서 토큰을 꺼내 서버로 보냅니다.** 서버는 `JwtStrategy`에서 이 쿠키를 꺼내 인증을 수행합니다.

---

## 5. 도배 방지 디테일 (UX/Performance)
단순 실시간을 넘어 서비스의 질을 높이는 설계입니다.

1.  **Actor 기반 중복 체크**: 
    - 만약 '유저 A'가 '유저 B'의 글을 여러 번 '좋아요' 취소/재클릭 하더라도, `actorId`를 체크하여 이미 읽지 않은 알림이 있다면 DB에 새로 쌓지 않습니다.
2.  **클라이언트 지능적 무효화**: 
    - 단순히 숫자를 +1 하는 게 아니라 `invalidateQueries`를 사용하여 서버의 최종 상태와 프론트엔드 상태를 항상 완벽하게 일치시킵니다.

---

## 6. 결론
이 시스템은 **보안(쿠키)**, **성능(SSE 스트림)**, **정확성(React Query)**을 모두 만족하는 설계입니다. 이 구조를 이해한다면 실시간 채팅, 실시간 주식 가격 알림 등 어떠한 실시간 서비스도 동일한 원리로 구현할 수 있습니다.
