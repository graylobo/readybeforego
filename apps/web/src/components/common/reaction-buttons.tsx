import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

interface ReactionButtonsProps {
  likeCount: number;
  dislikeCount: number;
  userReaction?: 'like' | 'dislike' | 'up' | 'down' | null;
  onLike: () => void;
  onDislike: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ReactionButtons({
  likeCount,
  dislikeCount,
  userReaction,
  onLike,
  onDislike,
  isLoading = false,
  className,
}: ReactionButtonsProps) {
  const isLiked = userReaction === 'like' || userReaction === 'up';
  const isDisliked = userReaction === 'dislike' || userReaction === 'down';

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
        <Button
          variant="outline"
          onClick={onLike}
          disabled={isLoading}
          className={cn(
            'flex-1 gap-2.5 transition-all duration-200 active:scale-95 cursor-pointer h-12 px-6 rounded-full',
            isLiked
              ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 font-bold shadow-md shadow-blue-500/20'
              : 'hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-muted-foreground'
          )}
        >
          <ThumbsUp className={cn("h-5 w-5", !isLiked && "text-muted-foreground")} />
          <span className="text-sm font-semibold"> {likeCount}</span>
        </Button>
        <Button
          variant="outline"
          onClick={onDislike}
          disabled={isLoading}
          className={cn(
            'flex-1 gap-2.5 transition-all duration-200 active:scale-95 cursor-pointer h-12 px-6 rounded-full',
            isDisliked
              ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 font-bold shadow-md shadow-red-500/20'
              : 'hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground'
          )}
        >
          <ThumbsDown className={cn("h-5 w-5", !isDisliked && "text-muted-foreground")} />
          <span className="text-sm font-semibold"> {dislikeCount}</span>
        </Button>
      </div>
    </div>
  );
}
