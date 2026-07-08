"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ChevronDown, ChevronRight, Film, X } from "lucide-react";
import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSidebarStore } from "@/lib/stores/sidebar.store";
import { useSidebarToggleStore } from "@/lib/stores/sidebar-toggle.store";
import { useLayoutStore } from "@/lib/stores/layout.store";

interface SubMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href: string;
  subMenu?: SubMenuItem[];
}

interface SidebarProps {
  items: MenuItem[];
}

const renderMenuIcon = (
  icon: ReactNode | undefined,
  label: string,
  isActive: boolean,
  isVisualOpen: boolean,
  isSubItem = false
) => {
  if (icon) {
    return <span className="shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>;
  }

  // For sub-menu items, display text only when sidebar is expanded, so return null
  if (isSubItem && isVisualOpen) {
    return null;
  }

  const initial = label.trim().charAt(0) || "?";
  return (
    <span
      className={cn(
        "shrink-0 w-5 h-5 flex items-center justify-center rounded-[6px] text-[10px] font-bold select-none border transition-all duration-200",
        isActive
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border"
      )}
    >
      {initial}
    </span>
  );
};

export function Sidebar({ items }: SidebarProps) {
  const { isOpen: isLocked, toggle, layoutMode, setIsOpen } = useSidebarToggleStore();
  const [isHovered, setIsHovered] = useState(false);
  const { pendingPath, setPendingPath } = useLayoutStore();
  const pathname = usePathname();
   const router = useRouter();

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setPendingPath(href);
    router.push(href);
  };
  const { expandedItems, updateExpandedItems, toggleExpandedItem } =
    useSidebarStore();
  const autoExpandedRef = useRef<Set<string>>(new Set());

  // Initialize based on screen width
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsOpen(true);
    }
  }, [setIsOpen]);

  // Visual Open State: Open if Locked (Manual) OR Hovered
  const isVisualOpen = isLocked || isHovered;

  // Initialize expanded items: Expand all by default and keep active path expanded
  useEffect(() => {
    updateExpandedItems((prev) => {
      const nextExpanded = new Set(prev);
      let changed = false;
      
      for (const item of items) {
        if (item.subMenu && item.subMenu.length > 0 && !autoExpandedRef.current.has(item.id)) {
          nextExpanded.add(item.id);
          autoExpandedRef.current.add(item.id);
          changed = true;
        }
      }
      
      return changed ? nextExpanded : prev;
    });
  }, [items, updateExpandedItems]);

  const toggleExpand = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    toggleExpandedItem(itemId);
  };

  
  const isItemActive = (item: MenuItem) => {
    const currentPath = pendingPath || pathname;
    if (item.subMenu) {
      return item.subMenu.some((subItem) => subItem.href === currentPath);
    }
    return item.href === currentPath;
  };

  const isSubItemActive = (subItem: SubMenuItem) => {
    const currentPath = pendingPath || pathname;
    return subItem.href === currentPath;
  };
  return (
    <aside
      className={cn(
        "relative h-full flex flex-col z-[60] transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] max-md:fixed max-md:left-0 max-md:top-0 max-md:h-screen max-md:!w-64 max-md:z-[100]",
        isLocked ? "w-64 max-md:translate-x-0" : "w-16 max-md:-translate-x-full",
        layoutMode === 'overlay' && "!absolute left-0 top-0 bottom-0"
      )}
      onMouseEnter={() => !isLocked && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "bg-sidebar dark:bg-[#181C1F] border-r border-sidebar-border flex flex-col h-full w-full overflow-hidden transition-all duration-300 ease-out",
          !isLocked && isHovered && "absolute top-0 left-0 w-64 shadow-[4px_0_24px_rgba(0,0,0,0.1)]"
        )}
      >
        {/* Sidebar Header (Logo + Close) */}
        <div className="flex h-16 items-center justify-between px-4 shrink-0">
           {/* Logo - Placeholder for now */}
          <div 
            className="flex items-center gap-2 cursor-pointer overflow-hidden"
            onClick={() => (window.location.href = '/')}
          >
            <span className={cn(
              "text-xl font-bold select-none truncate transition-all duration-300",
              isVisualOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
            )}>
              BOILER PLATE
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggle}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto p-2">
          {items.map((item) => {
            const isActive = isItemActive(item);
            const isExpanded = expandedItems.has(item.id);
            const hasSubMenuDefined = item.subMenu !== undefined;
            const hasSubMenuItems = item.subMenu && item.subMenu.length > 0;

            return (
              <div key={item.id} className="mb-1">
                {hasSubMenuDefined ? (
                  <>
                    <button
                      onClick={(e) => toggleExpand(item.id, e)}
                      className={cn(
                        "w-full flex items-center py-2 px-3 rounded-md transition-colors duration-200 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground select-none outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      {renderMenuIcon(item.icon, item.label, isActive, isVisualOpen, false)}
                      <span
                        className={cn(
                          "flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300",
                          isVisualOpen
                            ? "opacity-100 max-w-full ml-3"
                            : "opacity-0 max-w-0 ml-0"
                        )}
                      >
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 transition-all duration-300",
                          isVisualOpen
                            ? "opacity-100 w-4"
                            : "opacity-0 w-0 overflow-hidden"
                        )}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                    {isExpanded && hasSubMenuItems && (
                      <div
                        className={cn(
                          "mt-1",
                          isVisualOpen
                            ? "ml-4"
                            : "ml-0"
                        )}
                      >
                        {item.subMenu?.map((subItem) => {
                          const isSubActive = isSubItemActive(subItem);

                          return (
                            <Link
                              key={subItem.id}
                              href={subItem.href}
                              onClick={(e) => handleNavigation(e, subItem.href)}
                              className={cn(
                                "w-full flex items-center py-2 px-3 rounded-md transition-colors duration-200 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground select-none outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                isSubActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                              )}
                              title={!isVisualOpen ? subItem.label : undefined}
                            >
                              {renderMenuIcon(subItem.icon, subItem.label, isSubActive, isVisualOpen, true)}
                              <span
                                className={cn(
                                  "flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300",
                                  isVisualOpen
                                    ? cn("opacity-100 max-w-full", subItem.icon ? "ml-3" : "ml-0")
                                    : "opacity-0 max-w-0 ml-0"
                                )}
                              >
                                {subItem.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={(e) => handleNavigation(e, item.href)}
                    className={cn(
                      "w-full flex items-center py-2 px-3 rounded-md transition-colors duration-200 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground select-none outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    title={!isVisualOpen ? item.label : undefined}
                  >
                    {renderMenuIcon(item.icon, item.label, isActive, isVisualOpen, false)}
                    <span
                      className={cn(
                        "flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300",
                        isVisualOpen
                          ? "opacity-100 max-w-full ml-3"
                          : "opacity-0 max-w-0 ml-0"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
