-- Supabase Realtime 채널 권한 (REALTIME_PROVIDER=supabase일 때 필요). 여러 번 실행해도 안전하고,
-- Supabase가 아닌 Postgres(realtime.messages가 없음)에서는 아무 일도 하지 않는다.
--
-- 방문자(anon)와 로그인 사용자(authenticated)는
--   * chat:· notify: 채널을 받기만 한다 (메시지는 API 서버가 service_role 키로 보낸다 → 가짜 메시지를 뿌릴 수 없음)
--   * chat: 채널에 접속자 표시(presence)만 올릴 수 있다
-- notify: 채널 이름은 서버만 아는 키로 만든 값이라(RealtimeService.notificationTopic) 남의 채널을 알 수 없다
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "community_realtime_receive" ON realtime.messages;
  CREATE POLICY "community_realtime_receive" ON realtime.messages
    FOR SELECT TO anon, authenticated
    USING (realtime.topic() LIKE 'chat:%' OR realtime.topic() LIKE 'notify:%');

  DROP POLICY IF EXISTS "community_realtime_presence" ON realtime.messages;
  CREATE POLICY "community_realtime_presence" ON realtime.messages
    FOR INSERT TO anon, authenticated
    WITH CHECK (realtime.topic() LIKE 'chat:%' AND realtime.messages.extension = 'presence');
END $$;
