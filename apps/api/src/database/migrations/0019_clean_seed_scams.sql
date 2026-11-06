-- 시드 제보 정리: 추천 수를 실제 반응 수로 맞추고, 출처 없는 링크·단정적 표현·인종 지칭을 고치고, 방콕 카드를 다듬는다
--> statement-breakpoint
UPDATE scam_infos s SET upvote_count=(SELECT count(*) FROM scam_info_reactions r WHERE r.scam_info_id=s.id AND r.type='like'), downvote_count=(SELECT count(*) FROM scam_info_reactions r WHERE r.scam_info_id=s.id AND r.type='dislike');
--> statement-breakpoint
UPDATE scam_infos SET source_url=NULL WHERE source_url IN ('https://www.0404.go.kr','https://www.tripadvisor.com','https://www.naver.com','https://www.seoul.go.kr','');
--> statement-breakpoint
UPDATE scam_infos SET description=replace(description,'흑인 사기패들이','일행 여러 명이') WHERE description LIKE '%흑인 사기패들이%';
--> statement-breakpoint
UPDATE scam_infos SET description=replace(description,'젊은 여성 그룹이','여러 명이 무리를 지어') WHERE description LIKE '%젊은 여성 그룹이%';
--> statement-breakpoint
UPDATE scam_infos SET avoidance_tip=replace(avoidance_tip,'서명판을 들고 다가오는 모든 자선단체 위장 무리는 100% 소매치기입니다.','서명판을 들고 다가오는 무리는 소매치기일 수 있습니다.') WHERE avoidance_tip LIKE '%서명판을 들고 다가오는 모든 자선단체 위장 무리는 100% 소매치기입니다.%';
--> statement-breakpoint
UPDATE scam_infos SET avoidance_tip=replace(avoidance_tip,'길거리 호객꾼이 추천하는 술집은 100% 바가지 업소이므로 절대 따라가지 마십시오.','길거리 호객꾼이 추천하는 술집은 바가지 피해 위험이 크므로 따라가지 마십시오.') WHERE avoidance_tip LIKE '%길거리 호객꾼이 추천하는 술집은 100% 바가지 업소이므로 절대 따라가지 마십시오.%';
--> statement-breakpoint
UPDATE scam_infos SET title='"저렴한 툭툭 시내 투어" 제안 후 연계 매장 유도', description='카오산로드 주변에서 기사나 호객꾼이 시세보다 훨씬 싼 가격에 1시간 안팎으로 시내를 구경시켜 주겠다고 제안합니다. 막상 타면 순수한 관광이 아니라 기사와 연계된 보석 가게 같은 매장에 들르게 되고, 그곳에서 돈을 쓰도록 유도합니다.

알아채는 신호: 먼저 다가와서 제안한다. 가격이 지나치게 싸다. 경유지를 분명히 말하지 않는다.', avoidance_tip='지나치게 싼 투어 제안은 거절하는 편이 안전합니다. 타야 한다면 탑승 전에 목적지, 경유지, 가격을 확인하고 매장 방문은 거절하세요. 이동은 Grab이나 Bolt처럼 요금을 미리 확인할 수 있는 앱을 이용하세요.', source_url='https://12go.asia/en/travel-guides/thailand/bangkok/bangkok-scams', updated_at=now() WHERE id='10000000-0000-0000-0000-000000000001';
--> statement-breakpoint
UPDATE scam_infos SET title='"오늘 사원은 문을 닫았습니다" 거짓 안내', description='왓포나 왕궁으로 가는 길목에서 친절한 행인이 다가와 행사나 휴일 때문에 오늘은 입장할 수 없다고 말합니다. 그러고는 다른 사원을 구경시켜 주겠다며 교통편을 권하고, 결국 매장으로 데려갑니다.

알아채는 신호: 입구에 도착하기 전에 말을 건다. 닫았다는 말에 이어 바로 다른 코스를 권한다.', avoidance_tip='길에서 들은 말만 믿지 말고 매표소 입구까지 직접 가서 확인하세요. 왕궁은 왕실 행사로 실제 닫는 날도 있으니 공식 안내도 함께 확인하는 것이 좋습니다.', source_url='https://12go.asia/en/travel-guides/thailand/bangkok/bangkok-scams', updated_at=now() WHERE id='10000000-0000-0000-0000-000000000003';
--> statement-breakpoint
UPDATE scam_infos SET title='대마 성분 음식·음료 주의', description='태국은 2025년 6월부터 대마초 꽃의 구매와 사용에 태국 내 면허 전문가의 처방을 요구하는 등 규제를 강화했습니다. 그래도 관광지에서 대마 성분이 든 쿠키, 브라우니, 음료를 마주칠 수 있습니다. 태국 규제와 관계없이 한국 국민은 해외에서 대마를 섭취해도 국내법으로 처벌받을 수 있습니다.

알아채는 신호: 메뉴에 단풍잎 모양이나 Cannabis, THC, CBD, Organic Leaf 표기가 있다.', avoidance_tip='표기를 확인하고, 성분을 알 수 없는 길거리 젤리나 브라우니는 사지 마세요. 규제는 바뀔 수 있으니 출국 전에 외교부 해외안전여행 안내도 확인하세요.', source_url='https://www.tatnews.org/2025/06/cannabis-flower-now-strictly-regulated-in-thailand-important-notice-for-tourists/', updated_at=now() WHERE id='10000000-0000-0000-0000-000000000002';
--> statement-breakpoint
UPDATE scam_infos SET title='태국 관광지 유흥가 음료 약물 주의', description='태국의 관광지에서는 음료에 약물을 타서 저지르는 범죄가 실제로 발생합니다. 클럽이나 바에서 처음 만난 사람이 건네는 음료는 특히 조심해야 합니다.

알아채는 신호: 낯선 사람이 음료를 권한다. 자리를 비운 사이 잔이 그대로 놓여 있다.', avoidance_tip='낯선 사람이 주는 음료는 받지 말고, 내 잔을 자리에 두고 떠나지 마세요. 자리를 비웠다면 새로 주문하는 편이 안전합니다.', source_url='https://www.gov.uk/foreign-travel-advice/thailand/safety-and-security', updated_at=now() WHERE id='10000000-0000-0000-0000-000000000004';
--> statement-breakpoint
INSERT INTO scam_infos (id, city_id, country_code, scope, title, description, avoidance_tip, scam_category, source_url) SELECT '10000000-0000-0000-0000-000000000101', c.id, 'TH', 'city', '택시 미터기 사용 거부와 과다 요금', '일부 택시 기사가 미터기를 켜지 않고 시세보다 비싼 요금을 요구합니다.

알아채는 신호: 출발 전에 미터기를 켜지 않는다. 미터기를 요청해도 다른 이유를 대며 거부한다.', 'Grab이나 Bolt 같은 앱 또는 대중교통을 이용하면 이런 상황을 피할 수 있습니다. 택시를 탄다면 출발 전에 미터기가 켜졌는지 확인하세요.', 'FAKE_TAXI', 'https://12go.asia/en/travel-guides/thailand/bangkok/bangkok-scams' FROM cities c WHERE c.id='11111111-1111-4111-a111-111111111111' ON CONFLICT (id) DO NOTHING;
