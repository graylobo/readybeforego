import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatSiteDate, isSiteToday } from '@/lib/utils/date';
import { Eye, Image as ImageIcon, Pin, ThumbsUp, ChevronDown, ChevronUp, Heart, MessageSquare, Pencil, Trash2, ChevronLeft, ChevronRight, Share2, Bot, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Post as ApiPost } from '@/lib/api/board';
import { useAuthStore } from '@/lib/stores/auth.store';
import { markPendingNavigation, useLayoutStore } from '@/lib/stores/layout.store';
import { useDeletePost, useTogglePostReaction } from '@/hooks/queries/use-board-queries';
import { toast } from '@/lib/toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Comments } from '@/components/comments/comments';
import { useRef } from 'react';
import { FeedPostEditModal } from '@/components/board/feed-post-edit-modal';
import { ContentImage, extractContentImages } from '@/lib/utils/content-images';
import { htmlToPreviewText, isFeedEditableContent } from '@/lib/utils/feed-content';
import { MediaDetailModal } from '@/components/common/media-detail-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BotSourceButton } from '@/components/board/bot-source-button';

interface PostListProps {
  posts: (ApiPost & { _isBestBlock?: boolean })[];
  slug?: string;
  emptyMessage?: string;
  highlightQuery?: string;
  viewMode?: 'list' | 'lounge' | 'feed';
}


/** 비공개 처리한 글 표시. 비공개 글은 Super Admin 목록에만 내려오므로 따로 권한을 확인하지 않는다 */
function HiddenBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 px-1.5 py-0.5 font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-sm inline-flex items-center gap-0.5",
        className,
      )}
      title="Super Admin 전용: 비공개 처리한 글 (다른 사람에게는 보이지 않음)"
    >
      <EyeOff className="h-3 w-3" /> 비공개
    </span>
  );
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-[#ffeb3b] text-black px-0.5 rounded-sm inline-block font-bold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const getRelativeTimeStr = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatSiteDate(d, 'yyyy.MM.dd');
};



const extractAllImages = (content: string | undefined): ContentImage[] => {
  if (!content) return [];
  const images = extractContentImages(content);

  // Markdown image match url
  const mdRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = mdRegex.exec(content)) !== null) {
    if (match[1] && !images.some((img) => img.src === match![1])) images.push({ src: match[1] });
  }

  return images;
};

/**
 * 피드 이미지. 작은 버전 목록(srcset)이 있으면 칸 크기(sizes)에 맞는 것을 받는다.
 * 피드는 최대 768px(max-w-3xl) 너비라, 원본(최대 1920px)을 그대로 받으면 용량 낭비가 크다.
 */
const FEED_FULL_SIZES = '(max-width: 768px) 100vw, 768px';
const FEED_HALF_SIZES = '(max-width: 768px) 50vw, 384px';

function FeedImage({ image, sizes, alt, className }: { image: ContentImage; sizes: string; alt: string; className: string }) {
  return (
    <img
      src={image.src}
      srcSet={image.srcset}
      sizes={image.srcset ? sizes : undefined}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

function FeedImageGrid({ images }: { images: ContentImage[] }) {
  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden border border-border/50 aspect-video max-h-[360px] bg-muted/50">
        <FeedImage image={images[0]} sizes={FEED_FULL_SIZES} alt="post image" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full aspect-[2/1] max-h-[300px]">
        {images.map((img, i) => (
          <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/50 h-full">
            <FeedImage image={img} sizes={FEED_HALF_SIZES} alt={`post image ${i + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {/* Top 2 side by side */}
        <div className="grid grid-cols-2 gap-2 aspect-[2/1] max-h-[220px]">
          {images.slice(0, 2).map((img, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/50 h-full">
              <FeedImage image={img} sizes={FEED_HALF_SIZES} alt={`post image ${i + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" />
            </div>
          ))}
        </div>
        {/* Bottom 1 full width */}
        <div className="relative w-full rounded-xl overflow-hidden border border-border/50 aspect-[3/1] max-h-[140px] bg-muted/50">
          <FeedImage image={images[2]} sizes={FEED_FULL_SIZES} alt="post image 3" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" />
        </div>
      </div>
    );
  }

  // 4 or more images
  const remaining = images.length - 4;
  return (
    <div className="grid grid-cols-2 gap-2 w-full aspect-square max-h-[360px]">
      {images.slice(0, 4).map((img, i) => {
        const isLast = i === 3;
        return (
          <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/50 h-full">
            <FeedImage image={img} sizes={FEED_HALF_SIZES} alt={`post image ${i + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" />
            {isLast && remaining > 0 && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white text-lg font-black select-none">
                +{remaining}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 문단 끝을 줄바꿈으로 바꿔 미리보기(whitespace-pre-line)에서도 줄이 붙지 않게 한다
const stripHtml = htmlToPreviewText;

export function PostList({ 
  posts, 
  slug, 
  emptyMessage = "게시글이 없습니다.",
  highlightQuery,
  viewMode = 'list'
}: PostListProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const deletePostMutation = useDeletePost(slug || '');

  const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
  const [selectedInstagramPost, setSelectedInstagramPost] = useState<ApiPost | null>(null);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEdit = (e: React.MouseEvent, postId: string, postSlug: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 피드형 수정 창은 글자 + 이미지만 다루므로, 그 모양으로 쓴 글만 연다.
    // 레이아웃은 나중에 바뀔 수 있어, 일반 편집기로 쓴 글이나 수집한 글은 피드/라운지에서도 일반 편집기로 고친다
    const targetPost = viewMode === 'feed' || viewMode === 'lounge' ? posts.find(p => p.id === postId) : undefined;
    if (targetPost && isFeedEditableContent(targetPost.content)) {
      setEditingPost(targetPost);
      setIsEditModalOpen(true);
    } else {
      router.push(`/board/${postSlug}/${postId}/edit`);
    }
  };

  const handleDelete = (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
    
    deletePostMutation.mutate({ id: postId }, {
      onSuccess: () => {
        toast.success('게시글이 삭제되었습니다.');
      },
      onError: (error: any) => {
        toast.error(error?.message || '게시글 삭제에 실패했습니다.');
      }
    });
  };

  if (!posts || posts.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const notices = posts.filter(p => p.isNotice);
  const others = posts.filter(p => !p.isNotice);
  const COLLAPSED_NOTICE_COUNT = 2;
  const hasMoreNotices = notices.length > COLLAPSED_NOTICE_COUNT;
  
  const displayedNotices = isNoticeExpanded ? notices : notices.slice(0, COLLAPSED_NOTICE_COUNT);
  
  // 여러 게시판 글을 모은 목록(전체/베스트, 검색, 스크랩 등)이면 맨 앞에 게시판 칸을 두고 누르면 그 게시판으로 간다
  const showBoardColumn = !slug;
  const listGridCols = showBoardColumn
    ? 'md:grid-cols-[96px_1fr_100px_60px_60px_70px]'
    : 'md:grid-cols-[1fr_100px_60px_60px_70px]';

  const renderPost = (post: ApiPost & { _isBestBlock?: boolean }) => {
    const likeCount = post.likeCount || 0;
    const commentCount = post.commentCount || 0;
    const isPinned = post.isPinned || false;
    const isNotice = post.isNotice || false;
    const hasImage = post.hasImage || false; 
    
    const postBoard = (post as any).board as { slug?: string; name?: string } | undefined;
    const effectiveSlug = slug || postBoard?.slug;
    const postHref = effectiveSlug ? `/board/${effectiveSlug}/${post.id}` : '#';
    const boardHref = postBoard?.slug ? `/board/${postBoard.slug}` : undefined;
    // 게시판 이름 링크는 글 링크 안에 넣을 수 없어(링크 안의 링크) 한 줄을 [게시판 링크][글 링크]로 나눈다.
    // 데스크톱에서는 글 링크를 display: contents로 풀어 두 링크의 칸이 한 줄의 표 칸으로 나란히 놓인다
    const boardLink = showBoardColumn && postBoard?.name && boardHref ? (
      <Link
        href={boardHref}
        onClick={(e) => markPendingNavigation(e, boardHref)}
        className="truncate text-xs md:text-[13px] text-muted-foreground hover:text-primary hover:underline md:text-center md:self-center"
        title={`${postBoard.name} 게시판으로`}
      >
        {postBoard.name}
      </Link>
    ) : showBoardColumn ? <span className="hidden md:block" /> : null;

    return (
      <div
        key={`${post.id}${post._isBestBlock ? '-best' : ''}`}
        className={cn(
          'flex flex-col md:grid md:gap-4 px-4 py-4 md:py-3 transition-colors group',
          listGridCols,
          isNotice ? 'bg-blue-500/10 dark:bg-blue-500/10 hover:bg-blue-500/20 dark:hover:bg-blue-500/20' :
          post._isBestBlock ? 'bg-orange-500/10 dark:bg-orange-500/10 hover:bg-orange-500/20 dark:hover:bg-orange-500/20' :
          isPinned ? 'bg-muted dark:bg-muted/50 hover:bg-muted/80 dark:hover:bg-muted/70' : 'hover:bg-muted/50',
        )}
      >
      {boardLink && <div className="mb-1 md:mb-0 md:contents">{boardLink}</div>}
      <Link
        href={postHref}
        onClick={(e) => markPendingNavigation(e, postHref)}
        className={cn(
          'flex flex-col md:contents cursor-pointer',
          '[&:visited_.post-title]:!text-muted-foreground [&:visited_.post-title]:!font-normal [&:visited_.post-title]:opacity-70 [&:visited_.comment-count]:!text-muted-foreground [&:visited_.comment-count]:!font-normal [&:visited_.comment-count]:opacity-60'
        )}
      >
        <div className="flex items-start justify-between gap-4 min-w-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              {isNotice && (
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] md:text-xs font-bold bg-destructive text-white rounded-sm">
                  공지
                </span>
              )}
              {post._isBestBlock && !isNotice && (
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] md:text-xs font-bold bg-[#ff6b00] text-white rounded-sm">
                  인기
                </span>
              )}
              {isPinned && !isNotice && !post._isBestBlock && (
                <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              {post.category && (
                <span className="shrink-0 text-xs text-muted-foreground font-semibold">
                  [{post.category}]
                </span>
              )}
              {post.hiddenAt && <HiddenBadge className="text-[10px] md:text-xs" />}
              {isSuperAdmin && post.isBot && (
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[10px] md:text-xs font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-sm inline-flex items-center gap-0.5"
                  title={`Super Admin 전용: 크롤러 봇에 의해 등록된 게시글${post.botSource?.targetName ? ` (수집 카드: ${post.botSource.targetName}${post.botSource.galleryId ? ` / 디시 ID: ${post.botSource.galleryId}` : ' / 삭제된 카드'})` : ''}`}
                >
                  <Bot className="h-3 w-3" /> 봇{post.botSource?.targetName && ` · ${post.botSource.targetName}`}
                </span>
              )}
              {isSuperAdmin && post.isBot && <BotSourceButton postId={post.id} />}
              <span className={cn(
                "truncate text-[15px] md:text-sm md:font-normal transition-colors duration-200",
                "group-hover:text-primary",
                "post-title text-foreground font-semibold"
              )}>
                <HighlightedText text={post.title} query={highlightQuery} />
              </span>
              {hasImage && (
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-orange-500/80" />
              )}
              {commentCount > 0 && (
                <span className={cn(
                  "shrink-0 text-xs font-bold",
                  "text-primary",
                  "comment-count"
                )}>
                  [{commentCount}]
                </span>
              )}
            </div>

            <div className="flex md:hidden items-center gap-3 text-[12px] text-muted-foreground mt-0.5">
              <span className="truncate max-w-[80px] text-foreground/80">
                {post.user?.name || post.guestName}
              </span>
              <span className="text-[10px] opacity-30 select-none">|</span>
              <span>
                {post.createdAt && formatSiteDate(post.createdAt, isSiteToday(post.createdAt) ? 'HH:mm' : 'MM.dd')}
              </span>
              <span className="text-[10px] opacity-30 select-none">|</span>
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3 opacity-70" />
                <span>{post.viewCount}</span>
              </div>
              <span className="text-[10px] opacity-30 select-none">|</span>
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <ThumbsUp className="h-3 w-3" />
                <span>{likeCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block text-center text-sm text-muted-foreground truncate group-hover:text-primary transition-colors">
          {post.user ? (
            <span>{post.user.name}</span>
          ) : (
            <span>{post.guestName || '-'}</span>
          )}
        </div>

        <div className="hidden md:block text-center text-sm text-muted-foreground">
          {post.viewCount?.toLocaleString() || 0}
        </div>

        <div className="hidden md:block text-center text-sm text-green-600 dark:text-green-400">
          {likeCount}
        </div>

        <div className="hidden md:block text-center text-sm text-muted-foreground">
          {post.createdAt && formatSiteDate(post.createdAt, isSiteToday(post.createdAt) ? 'HH:mm' : 'MM.dd')}
        </div>
      </Link>
      </div>
    );
  };

function FeedPostCard({ 
  post, 
  slug, 
  highlightQuery, 
  user,
  handleEdit,
  handleDelete
}: { 
  post: ApiPost & { _isBestBlock?: boolean }; 
  slug?: string;
  highlightQuery?: string;
  user: any;
  handleEdit: (e: React.MouseEvent, id: string, slug: string) => void;
  handleDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const router = useRouter();
  // 이동이 늦으면 AppLayout이 스켈레톤을 보여주도록 이동 중인 주소를 알린다
  const setPendingPath = useLayoutStore((state) => state.setPendingPath);
  const toggleReactionMutation = useTogglePostReaction(post.id);

  const effectiveSlug = slug || (post as any).board?.slug;
  const postHref = effectiveSlug ? `/board/${effectiveSlug}/${post.id}` : '#';
  const authorName = post.user?.name || post.guestName || '익명';
  
  const previewText = stripHtml(post.content);
  const allImages = extractAllImages(post.content);

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const isAuthor = user?.id && post.userId && user.id === post.userId;
  const canManage = isSuperAdmin || isAuthor;

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    toggleReactionMutation.mutate('like');
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingPath(postHref);
    router.push(`/board/${effectiveSlug}/${post.id}?focusComment=true`);
  };

  const isLiked = post.userReaction === 'like';

  return (
    <Link
      href={postHref}
      onClick={(e) => markPendingNavigation(e, postHref)}
      className={cn(
        "bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col gap-3 group hover:-translate-y-0.5",
        post.isNotice ? "bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/10 dark:border-blue-500/20" :
        post._isBestBlock ? "bg-orange-500/5 dark:bg-orange-500/10 border-orange-500/10 dark:border-orange-500/20" : ""
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground/90">{authorName}</span>
          <span>·</span>
          <span>{getRelativeTimeStr(post.createdAt)}</span>
          {post.isNotice && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-destructive text-white rounded">공지</span>
          )}
          {post._isBestBlock && !post.isNotice && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-[#ff6b00] text-white rounded">인기</span>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={(e) => handleEdit(e, post.id, effectiveSlug)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              title="수정"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(e, post.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Title & Body Preview */}
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors flex items-center gap-2">
          {post.hiddenAt && <HiddenBadge className="text-xs" />}
          {user?.role === 'super_admin' && post.isBot && (
            <span
              className="shrink-0 px-1.5 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded inline-flex items-center gap-1"
              title={`Super Admin 전용: 크롤러 봇에 의해 등록된 게시글${post.botSource?.targetName ? ` (수집 카드: ${post.botSource.targetName}${post.botSource.galleryId ? ` / 디시 ID: ${post.botSource.galleryId}` : ' / 삭제된 카드'})` : ''}`}
            >
              <Bot className="h-3 w-3" /> 봇{post.botSource?.targetName && ` · ${post.botSource.targetName}`}
            </span>
          )}
          {user?.role === 'super_admin' && post.isBot && <BotSourceButton postId={post.id} />}
          <span>{post.title}</span>
        </h3>
        {previewText && (
          <p className="text-sm text-muted-foreground/80 line-clamp-3 leading-relaxed whitespace-pre-line">
            {previewText}
          </p>
        )}
      </div>

      {/* Image Grid */}
      <FeedImageGrid images={allImages} />

      {/* Footer Stats */}
      <div className="flex items-center gap-4 text-muted-foreground/60 text-xs font-medium mt-1 select-none z-10">
        <button 
          onClick={handleLike}
          disabled={toggleReactionMutation.isPending}
          className={cn(
            "flex items-center gap-1.5 transition-colors cursor-pointer hover:text-red-500",
            isLiked && "text-rose-500 hover:text-rose-600"
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-rose-500 text-rose-500")} />
          <span>{formatStatCount(post.likeCount || 0)}</span>
        </button>
        <button 
          onClick={handleCommentClick}
          className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{formatStatCount(post.commentCount || 0)}</span>
        </button>
        <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
          <Eye className="w-4 h-4" />
          <span>{formatStatCount(post.viewCount || 0)}</span>
        </div>
      </div>
    </Link>
  );
}

  const renderFeedPost = (post: ApiPost & { _isBestBlock?: boolean }) => {
    return (
      <FeedPostCard
        key={`${post.id}${post._isBestBlock ? '-best' : ''}`}
        post={post}
        slug={slug}
        highlightQuery={highlightQuery}
        user={user}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />
    );
  };

  const renderInstagramPost = (post: ApiPost & { _isBestBlock?: boolean }) => {
    return (
      <InstagramFeedCard
        key={`${post.id}${post._isBestBlock ? '-best' : ''}`}
        post={post}
        slug={slug}
        user={user}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        onCommentClick={(p) => {
          setSelectedInstagramPost(p);
          setIsInstagramModalOpen(true);
        }}
      />
    );
  };

  if (viewMode === 'lounge') {
    return (
      <div className="w-full max-w-[680px] mx-auto space-y-4">
        {displayedNotices.map(renderFeedPost)}
        
        {hasMoreNotices && (
          <div 
            onClick={() => setIsNoticeExpanded(!isNoticeExpanded)}
            className="flex items-center justify-center py-2.5 bg-muted/5 cursor-pointer hover:bg-muted/10 transition-colors text-xs font-medium text-muted-foreground select-none rounded-2xl border border-dashed border-border"
          >
            {isNoticeExpanded ? (
              <>공지 접기 <ChevronUp className="w-3.5 h-3.5 ml-1" /></>
            ) : (
              <>공지 더보기 <ChevronDown className="w-3.5 h-3.5 ml-1" /></>
            )}
          </div>
        )}

        {others.map(renderFeedPost)}

        {/* Lounge Edit Modal */}
        <FeedPostEditModal 
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          boardSlug={slug || ''}
          post={editingPost}
        />
      </div>
    );
  }

  if (viewMode === 'feed') {
    return (
      <div className="w-full max-w-[680px] mx-auto space-y-6">
        {displayedNotices.map(renderInstagramPost)}
        {others.map(renderInstagramPost)}

        {/* Instagram Details Dialog */}
        <InstagramCommentModal 
          isOpen={isInstagramModalOpen}
          onOpenChange={setIsInstagramModalOpen}
          post={selectedInstagramPost}
          slug={slug || ''}
        />

        {/* Feed Edit Modal */}
        <FeedPostEditModal 
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          boardSlug={slug || ''}
          post={editingPost}
        />
      </div>
    );
  }

  return (
    <div className="w-full border-t border-border/50">
      <div className={cn('hidden md:grid gap-4 px-4 py-3 text-sm font-medium text-muted-foreground border-b border-border/50', listGridCols)}>
        {showBoardColumn && <div className="text-center">게시판</div>}
        <div>제목</div>
        <div className="text-center">작성자</div>
        <div className="text-center">조회</div>
        <div className="text-center">추천</div>
        <div className="text-center">작성일</div>
      </div>

      <div className="divide-y divide-border/50">
        {displayedNotices.map(renderPost)}
        
        {hasMoreNotices && (
          <div 
            onClick={() => setIsNoticeExpanded(!isNoticeExpanded)}
            className="flex items-center justify-center py-2.5 bg-muted/5 cursor-pointer hover:bg-muted/10 transition-colors text-xs font-medium text-muted-foreground select-none"
          >
            {isNoticeExpanded ? (
              <>공지 접기 <ChevronUp className="w-3.5 h-3.5 ml-1" /></>
            ) : (
              <>공지 더보기 <ChevronDown className="w-3.5 h-3.5 ml-1" /></>
            )}
          </div>
        )}

        {others.map(renderPost)}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Instagram View Support Components
// ----------------------------------------------------

function InstagramImageSlider({ images, className }: { images: ContentImage[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, clientWidth } = containerRef.current;
      if (clientWidth > 0) {
        const index = Math.round(scrollLeft / clientWidth);
        setCurrentIndex(index);
      }
    }
  };

  const scrollTo = (index: number) => {
    if (containerRef.current) {
      const clientWidth = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: index * clientWidth,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex > 0) {
      scrollTo(currentIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex < images.length - 1) {
      scrollTo(currentIndex + 1);
    }
  };

  if (images.length === 0) return null;

  return (
    <div className={cn("relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden rounded-2xl group/slider border border-border/40", className)}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Scrollable Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
        style={{ 
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {images.map((image, i) => (
          <div key={i} className="min-w-full h-full snap-start relative flex items-center justify-center bg-zinc-950">
            <FeedImage image={image} sizes={FEED_FULL_SIZES} alt={`slide-${i}`} className="w-full h-full object-contain" />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {images.length > 1 && currentIndex > 0 && (
        <button 
          type="button"
          onClick={handlePrev}
          className="absolute left-3 w-8 h-8 rounded-full bg-background/90 hover:bg-background text-foreground flex items-center justify-center shadow-md transition-all z-20 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button 
          type="button"
          onClick={handleNext}
          className="absolute right-3 w-8 h-8 rounded-full bg-background/90 hover:bg-background text-foreground flex items-center justify-center shadow-md transition-all z-20 cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Dot Indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md shadow-md pointer-events-auto">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollTo(i);
              }}
              className={cn(
                "rounded-full transition-all cursor-pointer",
                i === currentIndex 
                  ? "bg-white w-2 h-2 shadow-xs scale-110" 
                  : "bg-white/40 hover:bg-white/80 w-1.5 h-1.5"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface InstagramCommentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  post: ApiPost | null;
  slug: string;
}

function InstagramCommentModal({ isOpen, onOpenChange, post, slug }: InstagramCommentModalProps) {
  if (!post) return null;

  const authorName = post.user?.name || post.guestName || '익명';
  const authorAvatar = (post.user as any)?.image || post.user?.picture || (post.user as any)?.profileImage || '';
  const allImages = extractAllImages(post.content);
  const cleanBody = stripHtml(post.content);
  const hasImages = allImages.length > 0;

  return (
    <MediaDetailModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      images={allImages.map((image) => image.src)}
      authorName={authorName}
      authorAvatar={authorAvatar}
      createdAt={post.createdAt}
      title={post.title && post.title !== cleanBody.slice(0, 30) ? post.title : undefined}
      description={cleanBody}
      targetType="post"
      targetId={post.id}
    />
  );
}

function InstagramFeedCard({
  post,
  slug,
  user,
  handleEdit,
  handleDelete,
  onCommentClick
}: {
  post: ApiPost & { _isBestBlock?: boolean };
  slug?: string;
  user: any;
  handleEdit: (e: React.MouseEvent, id: string, slug: string) => void;
  handleDelete: (e: React.MouseEvent, id: string) => void;
  onCommentClick: (post: ApiPost) => void;
}) {
  const toggleReactionMutation = useTogglePostReaction(post.id);
  const effectiveSlug = slug || (post as any).board?.slug;
  const authorName = post.user?.name || post.guestName || '익명';
  const authorAvatar = (post.user as any)?.image || post.user?.picture || (post.user as any)?.profileImage || '';
  const boardName = (post as any).board?.name || '라운지';
  const allImages = extractAllImages(post.content);
  const cleanBody = stripHtml(post.content);

  const [isExpanded, setIsExpanded] = useState(false);
  const isLiked = post.userReaction === 'like';

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const isAuthor = user?.id && post.userId && user.id === post.userId;
  const canManage = isSuperAdmin || isAuthor;

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    toggleReactionMutation.mutate('like');
  };

  const cleanBodyLines = cleanBody.split('\n');
  const shouldShowMore = cleanBody.length > 140 || cleanBodyLines.length > 4;
  const displayedBody = isExpanded ? cleanBody : (
    cleanBody.slice(0, 140) + (shouldShowMore ? '...' : '')
  );

  return (
    <div className="bg-card text-card-foreground border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col gap-3 p-4 hover:border-border/80 transition-all">
      {/* 1. Header (Avatar + Name + Relative Time + Board Target + Actions) */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="w-9 h-9 border border-border/40 shrink-0">
            <AvatarImage src={authorAvatar} alt={authorName} />
            <AvatarFallback className="bg-sky-500/10 text-sky-600 font-bold text-xs">
              {authorName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-xs leading-tight min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-sm text-foreground truncate">{authorName}</span>
              {post.hiddenAt && <HiddenBadge className="text-[10px]" />}
              {user?.role === 'super_admin' && post.isBot && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded shrink-0 inline-flex items-center gap-0.5"
                  title={`Super Admin 전용: 크롤러 봇에 의해 등록된 게시글${post.botSource?.targetName ? ` (수집 카드: ${post.botSource.targetName}${post.botSource.galleryId ? ` / 디시 ID: ${post.botSource.galleryId}` : ' / 삭제된 카드'})` : ''}`}
                >
                  <Bot className="w-2.5 h-2.5" /> 봇{post.botSource?.targetName && ` · ${post.botSource.targetName}`}
                </span>
              )}
              {user?.role === 'super_admin' && post.isBot && <BotSourceButton postId={post.id} />}
              {post.isNotice && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-destructive text-white rounded shrink-0">공지</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
              <span>{getRelativeTimeStr(post.createdAt)}</span>
              <span>·</span>
              <span className="text-muted-foreground/80 font-medium truncate">{boardName}에 남긴 글</span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => handleEdit(e, post.id, effectiveSlug)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-all cursor-pointer"
              title="수정"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(e, post.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all cursor-pointer"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Content Body (Main Text Content + Images) */}
      <div className="space-y-2.5 text-sm">
        {/* Title (If distinct from body) */}
        {post.title && post.title !== cleanBody.slice(0, 30) && (
          <h3 className="font-bold text-base text-foreground leading-snug">{post.title}</h3>
        )}

        {/* Text Body */}
        <div className="leading-relaxed whitespace-pre-line text-foreground/90 break-words">
          {displayedBody}
          {shouldShowMore && !isExpanded && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs text-primary font-bold ml-1.5 hover:underline cursor-pointer"
            >
              더 보기
            </button>
          )}
        </div>

        {/* Image Slider / Gallery */}
        {allImages.length > 0 && (
          <div className="w-full mt-2 rounded-xl overflow-hidden border border-border/40 shadow-xs">
            <InstagramImageSlider images={allImages} />
          </div>
        )}
      </div>

      {/* 3. Bottom Action Bar (Likes, Comments, Shares & Views) */}
      <div className="flex items-center justify-between text-muted-foreground/80 pt-2.5 border-t border-border/40 select-none text-xs font-semibold mt-1">
        <div className="flex items-center gap-5">
          {/* Like (Heart) Button */}
          <button 
            onClick={handleLike}
            disabled={toggleReactionMutation.isPending}
            className={cn(
              "flex items-center gap-1.5 transition-colors cursor-pointer hover:text-rose-500 group",
              isLiked && "text-rose-500 hover:text-rose-600"
            )}
          >
            <Heart className={cn("w-4 h-4 transition-transform group-active:scale-125", isLiked && "fill-rose-500 text-rose-500")} />
            <span className={cn("text-xs font-bold", isLiked ? "text-rose-500" : "text-muted-foreground")}>
              {formatStatCount(post.likeCount || 0)}
            </span>
          </button>

          {/* Comment Button */}
          <button 
            onClick={() => onCommentClick(post)}
            className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group"
          >
            <MessageSquare className="w-4 h-4 transition-transform group-active:scale-125" />
            <span className="text-xs font-bold text-muted-foreground">{formatStatCount(post.commentCount || 0)}</span>
          </button>

          {/* Share / Copy Link Button */}
          <button 
            onClick={() => {
              const url = `${window.location.origin}/board/${effectiveSlug}/${post.id}`;
              navigator.clipboard.writeText(url);
              toast.success("게시글 링크가 복사되었습니다.");
            }}
            className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
            title="링크 복사"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatStatCount(count: number): string {
  if (!count) return '0';
  if (count >= 10000) {
    const value = (count / 10000).toFixed(1);
    return value.endsWith('.0') ? `${Math.floor(count / 10000)}만` : `${value}만`;
  }
  if (count >= 1000) {
    const value = (count / 1000).toFixed(1);
    return value.endsWith('.0') ? `${Math.floor(count / 1000)}천` : `${value}천`;
  }
  return count.toString();
}
