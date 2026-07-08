'use client';

import React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CommonPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemsPerPage?: number;
  onItemsPerPageChange?: (value: number) => void;
  itemsPerPageOptions?: number[];
  position?: 'left' | 'center' | 'right';
}

export function CommonPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  itemsPerPage,
  onItemsPerPageChange,
  itemsPerPageOptions = [20, 30, 60, 100],
  position = 'center',
}: CommonPaginationProps) {
  const options = React.useMemo(() => {
    const opts = [...itemsPerPageOptions];
    if (itemsPerPage && !opts.includes(itemsPerPage)) {
      opts.push(itemsPerPage);
      opts.sort((a, b) => a - b);
    }
    return opts;
  }, [itemsPerPage, itemsPerPageOptions]);

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-center gap-4 w-full ${className || ''}`}>
      <div className="flex-1" />
      <Pagination className="w-auto mx-0 flex-none">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) {
                  onPageChange(currentPage - 1);
                }
              }}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            if (
              p === 1 || 
              p === totalPages || 
              (p >= currentPage - 2 && p <= currentPage + 2)
            ) {
              return (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(p);
                    }}
                    isActive={currentPage === p}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              );
            } else if (p === currentPage - 3 || p === currentPage + 3) {
              return (
                <PaginationItem key={p}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }
            return null;
          })}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1);
                }
              }}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {itemsPerPage !== undefined && onItemsPerPageChange && (
        <div className="flex items-center gap-2 m-0 p-0 sm:-ml-2">
          <Select 
            value={itemsPerPage.toString()} 
            onValueChange={(v) => { 
                onItemsPerPageChange(Number(v));
                onPageChange(1); // Reset to first page
            }}
          >
            <SelectTrigger className="w-auto min-w-[110px] h-9 text-xs rounded-full bg-muted/40 border-border/40 focus:ring-0 gap-2 px-4 shadow-sm">
              <SelectValue placeholder="표시 개수">
                {itemsPerPage}개씩 보기
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl min-w-[110px]">
              {options.map((opt) => (
                <SelectItem key={opt} value={opt.toString()} className="text-xs rounded-lg">
                  {opt}개씩 보기
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex-1" />
    </div>
  );
}
