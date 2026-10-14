'use client';

import React, { useMemo, useState } from 'react';
import { parsePreservedTerms } from '@community/shared-types';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PreservedTermsFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  // 입력칸 아래 적용 범위 안내 (카드용 / 공통용)
  scopeHint?: React.ReactNode;
}

/**
 * 보존 단어 입력칸. 작성 규칙 안내와, 입력한 내용이 실제로 어떻게 해석되는지 미리보기를 함께 보여준다.
 * (해석 규칙은 API와 같은 shared-types의 parsePreservedTerms를 사용)
 */
export function PreservedTermsField({
  id,
  value,
  onChange,
  rows = 2,
  placeholder = '예: 광상=광우상사(회사) 줄임말, 잉여햄, 광붕이=광상갤 유저들을 부르는 말',
  scopeHint,
}: PreservedTermsFieldProps) {
  const [showGuide, setShowGuide] = useState(false);
  const terms = useMemo(() => parsePreservedTerms(value), [value]);

  // 뜻 안에 쉼표를 써서 뜻이 별개의 단어로 잘린 것으로 의심되는 항목 (띄어쓰기가 들어간 뜻 없는 단어)
  const suspicious = terms.filter((t) => !t.meaning && /\s/.test(t.term));
  // "=뜻"처럼 단어 없이 뜻만 적어 무시되는 항목
  const ignoredCount = value
    .split(/[,\n]/)
    .filter((entry) => entry.includes('=') && !entry.split('=')[0].trim()).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>보존 단어 (줄임말·닉네임·은어)</Label>
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="text-[11px] text-primary flex items-center gap-0.5 cursor-pointer hover:underline"
        >
          작성 방법 {showGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {showGuide && (
        <div className="rounded-md border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground space-y-1.5">
          <p>
            AI가 다른 말로 바꾸면 안 되는 단어를 적습니다. 원문에 있는 보존 단어는 AI가 바꿀 수 없도록
            보호되며, 결과에서 사라지면 다시 작성하거나 등록하지 않습니다.
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              단어는 <b>쉼표(,)</b> 또는 <b>줄바꿈</b>으로 구분합니다.
            </li>
            <li>
              <b>단어=뜻</b>으로 적으면 AI가 문장을 자연스럽게 만들 때 참고합니다. 뜻에는 그 단어가
              <b> 무엇인지</b>(회사·사람·사람들을 부르는 말·동사 등) 적는 것이 가장 효과적입니다. 뜻은 결과
              글에 그대로 쓰이지 않습니다.
            </li>
            <li>
              뜻 없이 단어만 적어도 보호됩니다.
            </li>
          </ul>
          <div className="rounded bg-background border border-border px-2 py-1.5 font-mono text-[11px] text-foreground whitespace-pre-line">
            {'광상=광우상사(회사) 줄임말\n잉여햄=갤러리에서 유명한 사람 닉네임\n꼬라박다=크게 손해 보다\nㄹㅇ'}
          </div>
          <p className="flex items-start gap-1 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              뜻 안에는 쉼표를 쓰지 마세요. 쉼표는 단어 구분자라서 뜻이 잘립니다. (
              <code>광상=광우상사, 주식 종목</code> → &quot;주식 종목&quot;이 별개의 보존 단어가 됨) 쉼표 대신
              띄어쓰기를 쓰세요.
            </span>
          </p>
        </div>
      )}

      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {terms.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">AI에게 이렇게 전달됩니다 ({terms.length}개)</span>
          <div className="flex flex-wrap gap-1">
            {terms.map((t) => (
              <span
                key={t.term}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                  suspicious.includes(t) ? 'border-amber-500/60 bg-amber-500/10' : 'border-border bg-muted/40'
                }`}
              >
                <b className="text-foreground">{t.term}</b>
                <span className="text-muted-foreground">{t.meaning ? `= ${t.meaning}` : '(뜻 없음)'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {suspicious.length > 0 && (
        <p className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            {suspicious.map((t) => `"${t.term}"`).join(', ')}이(가) 별개의 단어로 처리됩니다. 앞 단어의 뜻을 쉼표로
            이어 적었다면 쉼표를 띄어쓰기로 바꾸세요.
          </span>
        </p>
      )}
      {ignoredCount > 0 && (
        <p className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>&quot;=&quot; 앞에 단어가 없는 항목 {ignoredCount}개는 무시됩니다.</span>
        </p>
      )}

      {scopeHint && <span className="block text-[11px] text-muted-foreground">{scopeHint}</span>}
    </div>
  );
}
