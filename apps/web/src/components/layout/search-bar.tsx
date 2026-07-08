import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchBar() {
  const router = useRouter();
  
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('titleContent');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const searchTypeLabels: Record<string, string> = {
    titleContent: '제목 + 내용',
    title: '제목',
    content: '내용',
    nickname: '닉네임',
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      alert('검색어를 입력해주세요');
      return;
    }

    setIsModalOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}&type=${searchType}`);
  };

  const SearchTrigger = () => (
    <div className="absolute left-0 h-full flex items-center z-10 px-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 pl-2 pr-1 gap-1 text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            <Search className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[160px] p-1.5 shadow-xl">
          <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">검색 필터</div>
          {Object.entries(searchTypeLabels).map(([key, label]) => (
            <DropdownMenuItem key={key} onClick={() => setSearchType(key)} className="flex items-center justify-between rounded-md">
              <span className="text-sm">{label}</span>
              {searchType === key && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {/* Mobile Search Icon & Dropdown */}
      <div className="lg:hidden relative">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsModalOpen(!isModalOpen)}
          className={cn(
            "text-muted-foreground transition-colors",
            isModalOpen && "bg-muted text-foreground"
          )}
        >
          <Search className="h-5 w-5" />
        </Button>

        {isModalOpen && (
          <>
            <div 
              className="fixed inset-0 z-[40]" 
              onClick={() => setIsModalOpen(false)} 
            />
            
            {/* Search Tooltip/Popover - Centered on screen */}
            <div className="fixed left-1/2 top-16 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-md z-[50] bg-card border shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top-2 fade-in duration-200">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="relative">
                  <Input
                    autoFocus
                    type="search"
                    placeholder="검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-4 pr-10 h-11 w-full bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {Object.entries(searchTypeLabels).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={searchType === key ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setSearchType(key)}
                      className="rounded-full px-3 h-7 text-[11px] font-bold"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Desktop Search Bar */}
      <form 
        onSubmit={handleSearch}
        className="hidden lg:flex items-center relative w-full max-w-[400px]"
      >
        <div className="relative w-full flex items-center group">
          <SearchTrigger />
          <Input
            type="search"
            placeholder="검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-14 pr-4 h-9 w-full bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary/50 transition-all rounded-full"
          />
        </div>
      </form>
    </>
  );
}
