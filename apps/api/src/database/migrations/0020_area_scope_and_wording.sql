-- 이동하는 호객·사기는 한 지점이 아니라 구역으로 표시하고, 제보 문구의 '수법'을 쉬운 표현으로 바꾼다
--> statement-breakpoint
-- 빈 DB는 모든 마이그레이션이 한 트랜잭션으로 실행되어 같은 트랜잭션에서 추가된 enum 값을 쓸 수 없으므로, 대상이 있을 때만 실행한다
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM scam_infos WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003')) THEN
    EXECUTE $q$UPDATE scam_infos SET scope='region' WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003') AND scope='spot'$q$;
  END IF;
END $$;
--> statement-breakpoint
UPDATE scam_infos SET title=replace(title,'밑장빼기 수법','밑장빼기') WHERE title LIKE '%밑장빼기 수법%';
--> statement-breakpoint
UPDATE scam_infos SET description=replace(description,'사기 수법입니다','사기입니다') WHERE description LIKE '%사기 수법입니다%';
