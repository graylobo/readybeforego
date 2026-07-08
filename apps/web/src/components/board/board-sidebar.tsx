import { useBoards } from '@/hooks/queries/use-board-queries';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function BoardSidebar() {
    const { data: boards } = useBoards();

    const pathname = usePathname();

    return (
        <div className="w-full md:w-64">
            <div className="font-semibold px-2 mb-2">Community</div>
            <nav className="flex flex-col gap-1">
                {boards?.map((board) => (
                    <Link
                        key={board.id}
                        href={`/board/${board.slug}`}
                        className={cn(
                            "block px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                            pathname === `/board/${board.slug}` ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                        )}
                    >
                        {board.name}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
