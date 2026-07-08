import { useMenuItems, MenuItem } from '@/hooks/use-menu-items';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { Button } from '@/components/ui/button';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { useRouter } from 'next/navigation';

export function TopNav() {
  const { layoutMode,setPendingPath } = useLayoutStore();
  const { user } = useAuthStore();
  const allMenuItems = useMenuItems();

    const router = useRouter();

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setPendingPath(href);
    router.push(href);
  };

  if (user && !user.isProfileSetup) return null;

  const headerItems = allMenuItems.filter(item => !item.isExtra);
  const extraItems = allMenuItems.filter(item => item.isExtra);

  return (
    <nav className={cn(
      "hidden md:flex items-center gap-1 lg:gap-2 transition-all duration-500",
      layoutMode === 'top' ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none w-0"
    )}>
      {headerItems.map((item) => (
        <div key={item.id} className="relative group">
          {item.subMenu ? (() => {
            const hasGroups = item.subMenu.some((sub: any) => sub.group);

            if (hasGroups) {
              const groups = item.subMenu.reduce((acc: Record<string, typeof item.subMenu>, current: any) => {
                const groupName = current.group || '기타';
                if (!acc[groupName]) {
                  acc[groupName] = [];
                }
                const currentArr = acc[groupName];
                if (currentArr) {
                    currentArr.push(current);
                }
                return acc;
              }, {});

              return (
                <>
                  <Button variant="ghost" size="sm" className="gap-1 font-bold text-muted-foreground hover:text-foreground transition-all group-hover:bg-muted/50 group-hover:text-foreground rounded-md">
                    {item.label}
                    <ChevronDown className="h-4 w-4 opacity-50 group-hover:rotate-180 transition-transform duration-200" />
                  </Button>
                  
                  <div className="absolute left-0 top-full pt-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-max origin-top-left group-hover:animate-in group-hover:fade-in group-hover:slide-in-from-top-2">
                    <div className="p-4 shadow-2xl border border-border/40 rounded-lg bg-popover text-popover-foreground">
                      <div className="flex gap-8">
                        {Object.entries(groups).map(([groupName, subs]) => (
                          <div key={groupName} className="flex flex-col min-w-[140px]">
                            <div className="text-[13px] font-bold text-[#0066FF] dark:text-[#3B82F6] mb-3 border-b border-[#0066FF]/20 dark:border-[#3B82F6]/20 pb-2 px-1">
                              {groupName}
                            </div>
                            <div className="flex flex-col space-y-1">
                              {subs?.map((sub: any) => (
                                <Link key={sub.id} href={sub.href} onClick={(e) => handleNavigation(e, sub.href)} className="w-full px-2 py-2 flex items-center gap-2.5 rounded-md hover:bg-muted font-medium transition-colors cursor-pointer text-sm">
                                  {sub.icon && <span className="shrink-0 flex items-center">{sub.icon}</span>}
                                  {sub.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              );
            }

            return (
              <>
                <Button variant="ghost" size="sm" className="gap-1 font-bold text-muted-foreground hover:text-foreground transition-all group-hover:bg-muted/50 group-hover:text-foreground rounded-md">
                  {item.label}
                  <ChevronDown className="h-4 w-4 opacity-50 group-hover:rotate-180 transition-transform duration-200" />
                </Button>

                <div className="absolute left-0 top-full pt-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-48 origin-top-left group-hover:animate-in group-hover:fade-in group-hover:slide-in-from-top-2">
                  <div className="w-full p-1 shadow-xl border border-border/50 rounded-lg bg-popover text-popover-foreground">
                    {item.subMenu.map((sub: any) => (
                         <Link key={sub.id} href={sub.href} onClick={(e) => handleNavigation(e, sub.href)} className="w-full px-2 py-2 flex items-center gap-2 rounded-md hover:bg-muted font-medium transition-colors cursor-pointer text-sm mb-0.5 last:mb-0">
                        {sub.icon && <span className="shrink-0 flex items-center opacity-70">{sub.icon}</span>}
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            );
          })() : (
            <Button variant="ghost" size="sm" asChild className="font-bold text-muted-foreground hover:text-foreground transition-all active:scale-95 group-hover:bg-muted/50 group-hover:text-foreground rounded-md">
              <Link href={item.href} onClick={(e) => handleNavigation(e, item.href)}>{item.label}</Link>
            </Button>
          )}
        </div>
      ))}

      {extraItems.length > 0 && (
        <div className="relative group">
          <Button variant="ghost" size="sm" className="gap-1 font-bold text-muted-foreground hover:text-foreground transition-all group-hover:bg-muted/50 group-hover:text-foreground rounded-md">
            기타
            <ChevronDown className="h-4 w-4 opacity-50 group-hover:rotate-180 transition-transform duration-200" />
          </Button>
          
          <div className="absolute right-0 top-full pt-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-[600px] lg:w-[800px] origin-top-right group-hover:animate-in group-hover:fade-in group-hover:slide-in-from-top-2">
            <div className="w-full p-6 shadow-2xl border border-border/40 rounded-lg bg-popover text-popover-foreground grid grid-cols-4 gap-8">
              {extraItems.map((item) => (
                <div key={item.id} className="space-y-4">
                  <div className="flex items-center gap-2 group/title cursor-pointer">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover/title:bg-primary/10 group-hover/title:text-primary transition-colors">
                      {item.icon}
                    </div>
                  <Link href={item.href} onClick={(e) => handleNavigation(e, item.href)} className="font-bold text-foreground group-hover/title:text-primary transition-colors">
                      {item.label}
                    </Link>
                  </div>
                  {item.subMenu && (
                    <ul className="space-y-2.5 pl-1.5 border-l-2 border-muted hover:border-primary/30 transition-colors">
                      {item.subMenu.map((sub) => (
                        <li key={sub.id}>
                         <Link 
                            href={sub.href} 
                            onClick={(e) => handleNavigation(e, sub.href)}
                            className="text-sm text-muted-foreground hover:text-primary font-medium transition-colors block py-0.5 hover:translate-x-1 duration-200"
                          >
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
