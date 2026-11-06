import type { DashboardTask } from '@/lib/api/admin';
import { TASK_META } from './dashboard-config';

interface BadgeTarget {
  href: string;
  badge?: number;
  subMenu?: BadgeTarget[];
}

/** 처리할 일의 대기 건수를 같은 곳으로 가는 메뉴에 배지로 붙인다 */
export function applyTaskBadges<T extends BadgeTarget>(items: T[], tasks: DashboardTask[] | undefined): T[] {
  if (!tasks?.length) return items;
  const countByHref = new Map<string, number>();
  for (const task of tasks) {
    const href = TASK_META[task.key]?.href;
    if (href) countByHref.set(href, (countByHref.get(href) ?? 0) + task.count);
  }
  const withBadge = <U extends BadgeTarget>(item: U): U => ({
    ...item,
    badge: countByHref.get(item.href) ?? item.badge,
    ...(item.subMenu ? { subMenu: item.subMenu.map(withBadge) } : {}),
  });
  return items.map(withBadge);
}
