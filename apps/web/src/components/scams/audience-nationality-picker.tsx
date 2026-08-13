'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { ISO_COUNTRY_NAMES_KO, getFlagEmoji, getKoreanCountryName } from '@community/shared-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

export const MAX_AUDIENCE_NATIONALITIES = 3;

export function parseAudienceNationalities(value?: string | null): string[] {
  return value
    ? value.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean)
    : [];
}

export function serializeAudienceNationalities(codes: string[]): string | null {
  const unique = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))].slice(0, MAX_AUDIENCE_NATIONALITIES);
  return unique.length > 0 ? unique.join(',') : null;
}

const NATIONALITY_OPTIONS = Object.entries(ISO_COUNTRY_NAMES_KO)
  .filter(([code]) => code !== 'UK')
  .map(([code, name]) => ({
    value: code,
    label: `${getFlagEmoji(code)} ${name}`,
    keywords: `${name} ${code}${code === 'KR' ? ' 한국' : ''}`,
  }));

interface AudienceNationalityPickerProps {
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

export function AudienceNationalityBadges({ value }: { value?: string | null }) {
  const codes = parseAudienceNationalities(value);
  if (codes.length === 0) return null;

  return (
    <>
      {codes.map((code) => (
        <Badge
          key={code}
          variant="outline"
          className="bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900/50 text-sky-700 dark:text-sky-400 text-[10px] font-semibold py-0.5 px-2 shrink-0"
        >
          {getFlagEmoji(code)} {getKoreanCountryName(code)} 여행자
        </Badge>
      ))}
    </>
  );
}

export function AudienceNationalityPicker({
  value,
  onChange,
  disabled,
}: AudienceNationalityPickerProps) {
  const [mode, setMode] = useState<'all' | 'specific'>(value.length > 0 ? 'specific' : 'all');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const serialized = value.join(',');
  useEffect(() => {
    if (serialized) setMode('specific');
  }, [serialized]);

  const isSpecific = mode === 'specific';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NATIONALITY_OPTIONS;
    return NATIONALITY_OPTIONS.filter((option) => option.keywords.toLowerCase().includes(q) || option.label.toLowerCase().includes(q));
  }, [query]);

  const toggleCode = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((item) => item !== code));
      return;
    }
    if (value.length >= MAX_AUDIENCE_NATIONALITIES) {
      toast.warning('국적은 최대 3개까지 선택할 수 있습니다.', { id: 'max-audience-nationalities' });
      return;
    }
    onChange([...value, code]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          이 내용은 누구에게 해당하나요? <span className="text-muted-foreground font-normal">(선택)</span>
        </Label>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        비워두면 모든 여행자에게 보입니다. 특정 국적에만 해당하면 골라 주세요.
      </p>

      <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setMode('all');
            onChange([]);
          }}
          className={cn(
            'flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer transition-all duration-200',
            !isSpecific
              ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
          )}
        >
          모든 여행자
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setMode('specific');
            setOpen(true);
          }}
          className={cn(
            'flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer transition-all duration-200',
            isSpecific
              ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
          )}
        >
          특정 국적
        </button>
      </div>

      {isSpecific && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {value.map((code) => {
              const option = NATIONALITY_OPTIONS.find((item) => item.value === code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60"
                >
                  {option?.label || code}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleCode(code)}
                    className="cursor-pointer hover:text-sky-950 dark:hover:text-white"
                    aria-label={`${option?.label || code} 제거`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>

          <Popover
            modal
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setQuery('');
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                className="w-full h-9 justify-between font-normal text-xs px-3 cursor-pointer"
              >
                <span className="text-muted-foreground">국적 검색해서 추가 (최대 3개)</span>
                <Search className="h-3.5 w-3.5 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0 rounded-md"
            >
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="예: 한국, 미국, KR"
                    className="h-8 text-xs pl-8"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">검색 결과가 없습니다.</p>
                ) : (
                  filtered.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-left cursor-pointer hover:bg-accent hover:text-accent-foreground',
                          isSelected && 'bg-accent text-accent-foreground'
                        )}
                        onClick={() => toggleCode(option.value)}
                      >
                        <Check className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
