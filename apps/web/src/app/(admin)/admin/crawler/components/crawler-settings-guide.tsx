'use client';

import React from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * 수집 설정 도움말: 상황별 추천 설정과 각 항목이 실제로 어떻게 동작하는지.
 * 버튼(CrawlerSettingsGuideButton)을 누르면 그 아래에 펼쳐진다 (CrawlerSettingsGuidePanel).
 * 떠 있는 창(팝오버)으로 하면 수집 설정 창 밖에 그려져 휠 스크롤이 막히거나, 창 안에 그리면 잘려서 펼침 방식으로 했다
 */
export function CrawlerSettingsGuideButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <CircleHelp className="h-3.5 w-3.5" /> 설정 도움말
      <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

const Strong = ({ children }: { children: React.ReactNode }) => <b className="text-foreground">{children}</b>;

export function CrawlerSettingsGuidePanel() {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed space-y-3">
      <section className="space-y-1">
        <h5 className="font-semibold text-sm">디시에 새로 올라오는 글을 따라 수집하려면</h5>
        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          <li><Strong>수집 페이지 범위 1~1</Strong>: 1페이지에 가장 최근 글이 있습니다.</li>
          <li><Strong>최소 추천수 0</Strong>: 막 올라온 글은 추천이 거의 없어 조건을 걸면 새 글이 다 빠집니다.</li>
          <li><Strong>켠 이후 올라온 글만 수집 켜기</Strong>: 켜기 전에 이미 있던 글은 가져오지 않습니다.</li>
          <li>
            <Strong>수집 주기는 갤러리 속도에 맞게</Strong>: 모바일 1페이지에 약 25개가 들어갑니다. 수집 사이에 25개보다 많이 올라오면 밀려난
            글은 놓치니, 빠른 갤러리는 주기를 줄이거나(예: 5분) 페이지를 1~2로 늘리세요.
          </li>
          <li><Strong>1회 수집 최대 개수</Strong>: 수집 주기 동안 올라오는 새 글 수 정도. 많을수록 AI 비용이 듭니다.</li>
          <li>
            <Strong>1개씩 띄엄띄엄 올리려면</Strong>: 1회 수집 최대 개수 1 + 실시간 등록 + 수집 주기를 범위로(예: 5~10분). 매번 다른 간격으로
            1개씩 올라가 일정한 간격으로 보이지 않습니다 (첫 글은 [시작] 후 1분 안에).
          </li>
          <li>
            <Strong>제외 키워드</Strong>: 제목이나 본문에 이 단어가 있는 글은 건너뛰고 다음 글을 가져옵니다 (1회 수집 개수에 세지 않음).
          </li>
        </ul>
      </section>

      <section className="space-y-1">
        <h5 className="font-semibold text-sm">등록 시간과 등록 순서</h5>
        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          <li><Strong>순서 유지</Strong>: 먼저 등록한 글보다 과거가 되지 않아, 등록한 순서대로 목록에 쌓입니다. 글 간격은 1~5분 무작위.</li>
          <li><Strong>섞기</Strong>: 글마다 범위 안에서 시각을 따로 뽑아 순서가 섞입니다. 앞서 올린 글들 사이에 끼어들 수도 있습니다.</li>
          <li>
            <Strong>섞기를 쓸 때 범위는 수집 주기와 비슷하게</Strong> (예: 10분마다 수집 → 0~10분). 범위가 훨씬 크면(0~120분) 새 글이 1~2시간
            전 글 사이로 들어가 목록 아래에 묻힙니다.
          </li>
          <li>범위가 좁은데 1회 수집 개수가 많으면 글이 촘촘히 몰려 보입니다 (예: 0~30분에 20개).</li>
          <li><Strong>실시간 등록</Strong>은 &quot;방금 전&quot; 기준이라 항상 순서 유지입니다.</li>
        </ul>
      </section>

      <section className="space-y-1">
        <h5 className="font-semibold text-sm">페이지 범위를 넓히면 (예: 1~10)</h5>
        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          <li>
            <Strong>수집 방향: 최신 글부터</Strong>(기본): 1페이지 위쪽부터 아직 안 가져온 글을 1회 수집 개수만큼 가져옵니다. 1페이지를 다
            가져가면 다음 수집 때 2페이지, 3페이지 … 순으로 점점 과거 글을 가져와서, 순서 유지여도 과거 글이 나중에 등록되어 디시의 시간 순서와
            반대가 될 수 있습니다.
          </li>
          <li>
            <Strong>수집 방향: 예전 글부터</Strong>: 끝 페이지 아래쪽(가장 예전 글)부터 가져와 여러 번에 걸쳐 수집해도 디시 시간 순서대로
            쌓입니다. 대신 최신 글은 예전 글을 다 가져온 뒤에 들어옵니다.
          </li>
        </ul>
      </section>

      <section className="space-y-1">
        <h5 className="font-semibold text-sm">수집 주기를 짧게 할 때</h5>
        <p className="text-muted-foreground">
          새 글이 없으면 AI 비용은 들지 않지만, 디시에는 수집할 때마다 페이지당 2번 요청합니다. 1분 주기에 1~10페이지면 1분에 20번이라 차단될 수
          있으니, 짧은 주기에는 페이지 1~1과 &apos;켠 이후 올라온 글만&apos;을 함께 쓰세요 (최신 글부터 수집이면 새 글이 없을 때 1페이지에서 멈춤).
        </p>
      </section>

      <section className="space-y-1">
        <h5 className="font-semibold text-sm">AI가 실패하면</h5>
        <p className="text-muted-foreground">
          원문을 그대로 올리지 않고 그 글을 실패로 기록합니다 (다음 수집 때 다시 시도). 실패 이유는 수집 이력에서 볼 수 있습니다. 같은 글이 3번
          실패하면 더 시도하지 않습니다 (AI 키 없음·모델 장애처럼 AI 자체를 못 쓴 경우는 횟수에 세지 않음).
        </p>
      </section>
    </div>
  );
}
