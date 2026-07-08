import { useAuthStore } from '@/lib/stores/auth.store';
import { toast } from '@/lib/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { CommentTargetType, CommentTree } from '@/lib/api/comments';
import { CreateCommentDto, isAdmin } from '@community/shared-types';
import { uploadsApi } from '@/lib/api/uploads';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useToggleCommentReaction,
  useUpdateComment,
  commentKeys
} from '@/hooks/queries/use-comment-queries';
import { CommentActions } from '@/components/comments/comment-item';

interface UseCommentsBehaviorProps {
  targetType: CommentTargetType;
  targetId: string;
  defaultRepliesVisible?: boolean;
  onMutationSuccess?: () => void;
}

export function useCommentsBehavior({ targetType, targetId, defaultRepliesVisible = true, onMutationSuccess }: UseCommentsBehaviorProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading: loading, isPlaceholderData } = useComments(targetType, targetId, page, limit);

  const comments = useMemo(() => data?.comments ?? [], [data?.comments]);
  const bestComments = useMemo(() => data?.bestComments ?? [], [data?.bestComments]);
  const pagination = data?.pagination;

  const createCommentMutation = useCreateComment(targetType, targetId);
  const updateCommentMutation = useUpdateComment(targetType, targetId);
  const deleteCommentMutation = useDeleteComment(targetType, targetId);
  const toggleReactionMutation = useToggleCommentReaction(targetType, targetId);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [repliesVisible, setRepliesVisible] = useState<Record<string, boolean>>({});

  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightedRef = useRef<string | null>(null);
  const lastAutoScrolledIdRef = useRef<string | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pathname = usePathname();
  const searchParams_ = useSearchParams();
  const currentUrl = encodeURIComponent(`${pathname}${searchParams_.toString() ? `?${searchParams_.toString()}` : ''}`);

  const findComment = (
    commentsList: CommentTree[],
    id: string
  ): CommentTree | null => {
    for (const comment of commentsList) {
      if (comment.id === id) return comment;
      if (comment.replies.length > 0) {
        const found = findComment(comment.replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  const scrollToComment = (commentId: string) => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    // closest('main')은 page-container가 withAds일 때 추가하는 '스크롤 불가능한' 안쪽 <main>을
    // 잡아버려 scrollTo가 무시된다. 실제로 스크롤 가능한 조상(app-layout의 overflow-y-auto <main> 등)을 직접 찾는다.
    const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
        let current: HTMLElement | null = node?.parentElement ?? null;
        while (current) {
          const overflowY = window.getComputedStyle(current).overflowY;
          const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
          if (canScroll && current.scrollHeight > current.clientHeight) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
    };

    const attemptScroll = () => {
        const element = commentRefs.current[commentId];
        if (!element) return false;

        const scroller = findScrollParent(element);

        if (scroller) {
          const scrollerRect = scroller.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const relativeTop = elementRect.top - scrollerRect.top + scroller.scrollTop;

          scroller.scrollTo({
            top: relativeTop - 100,
            behavior: 'smooth'
          });
        } else {
          // 스크롤 컨테이너가 document/window인 경우 브라우저가 알아서 컨테이너를 찾도록 위임
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const commentContent = element.querySelector(
          `.comment-content-${commentId}`
        ) as HTMLElement;

        if (commentContent) {
          document.querySelectorAll('.highlight-comment').forEach(el => {
            el.classList.remove('highlight-comment');
          });

          commentContent.classList.add('highlight-comment');
          highlightedRef.current = commentId;

          setTimeout(() => {
            commentContent.classList.remove('highlight-comment');
            if (highlightedRef.current === commentId) {
              highlightedRef.current = null;
            }
          }, 2000);
        }
        return true;
    };

    let attempts = 0;
    scrollIntervalRef.current = setInterval(() => {
        if (attemptScroll() || attempts > 20) {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
        }
        attempts++;
    }, 100);
  };

  useEffect(() => {
    const checkAndScroll = (isManualHashChange = false, explicitId?: string) => {
      if (typeof window === 'undefined') return;
      
      const hashId = window.location.hash.replace('#comment-', '');
      const queryId = searchParams_.get('commentId');
      const urlId = queryId || (hashId.length > 0 ? hashId : null);
      const id = explicitId || urlId;

      if (id && comments.length > 0) {
        if (isManualHashChange || id !== lastAutoScrolledIdRef.current) {
          const comment = findComment(comments, id);
          if (comment) {
            scrollToComment(id);
            lastAutoScrolledIdRef.current = id;
          }
        }
      } else if (!id) {
        lastAutoScrolledIdRef.current = null;
      }
    };

    checkAndScroll();

    const handleHashChange = () => checkAndScroll(true);
    
    const handleNotificationClick = (e: any) => {
      const link = e.detail.link;
      const hash = link.split('#')[1];
      if (hash && hash.startsWith('comment-')) {
        const id = hash.replace('comment-', '');
        queryClient.invalidateQueries({ queryKey: commentKeys.lists(targetType, targetId) });
        lastAutoScrolledIdRef.current = null; 
        checkAndScroll(true, id);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('notification-click', handleNotificationClick);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('notification-click', handleNotificationClick);
    };
  }, [comments, searchParams_]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateComment = async (dto: CreateCommentDto) => {
    try {
      await createCommentMutation.mutateAsync(dto, {
        onSuccess: () => {
          if (!dto.parentId) {
            setPage(1);
          }
          onMutationSuccess?.();
          toast.success('댓글이 등록되었습니다.');
        }
      });
    } catch (e) {
      console.error('Failed to create comment:', e);
    }
  };

  const handleReply = async (dto: CreateCommentDto) => {
    try {
      await createCommentMutation.mutateAsync(dto, {
        onSuccess: () => {
          setReplyingTo(null);
          onMutationSuccess?.();
          toast.success('답글이 등록되었습니다.');
        }
      });
    } catch (e) {
      console.error('Failed to reply:', e);
    }
  };

  const handleUpdateComment = async (
    commentId: string, 
    content: string, 
    imageUrl?: string | null,
    emoticonUrl?: string | null
  ) => {
    const comment = findComment(comments, commentId);
    if (!comment) return;
    
    // Check if content/emoticon/image exists
    if (!content?.trim() && !emoticonUrl && !imageUrl && !comment.emoticonUrl && !comment.imageUrl) return;

    let guestPasswordInput: string | undefined = undefined;
    const isUserAdmin = isAdmin(user?.role);
    if (!comment.userId && !isUserAdmin) {
      const input = prompt('비밀번호를 입력해주세요.');
      if (!input) return;
      guestPasswordInput = input;
    }

    try {
      // If we are removing or replacing an image that previously existed
      const previousImageUrl = (comment as any).imageUrl;
      const hasImageChanged = previousImageUrl && 
        (imageUrl === null || (typeof imageUrl === 'string' && imageUrl !== previousImageUrl));

      await updateCommentMutation.mutateAsync({
        id: commentId,
        content,
        imageUrl, 
        emoticonUrl, 
        guestPassword: guestPasswordInput,
      }, {
        onSuccess: () => {
          setEditingId(null);
          // Only delete FROM STORAGE if DB update was successful and image was actually changed/removed
          if (hasImageChanged) {
            uploadsApi.deleteImage(previousImageUrl);
          }
        }
      });
    } catch (e) {
      console.error('Failed to update comment:', e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const comment = findComment(comments, commentId);
    if (!comment) return;

    let guestPasswordInput: string | undefined = undefined;
    const isUserAdmin = isAdmin(user?.role);
    if (!comment.userId && !isUserAdmin) {
      const input = prompt('비밀번호를 입력해주세요.');
      if (!input) return;
      guestPasswordInput = input;
    }

    try {
      await deleteCommentMutation.mutateAsync({
        id: commentId,
        guestPassword: guestPasswordInput,
      }, {
        onSuccess: () => {
          onMutationSuccess?.();
        }
      });
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  const handleCommentAction = async (
    commentId: string,
    action: 'upvote' | 'downvote'
  ) => {
    try {
      await toggleReactionMutation.mutateAsync({
        id: commentId,
        type: action === 'upvote' ? 'like' : 'dislike',
      });
    } catch (e) {
      console.error('Failed to update comment action:', e);
    }
  };

  const parseMentions = (
    content: string,
    allComments: CommentTree[],
    currentComment: CommentTree
  ) => {
    const parts: React.ReactNode[] = [];
    const commentMap = new Map<string, CommentTree>();
    const traverseComments = (comments: CommentTree[]) => {
      for (const comment of comments) {
        commentMap.set(comment.id, comment);
        if (comment.replies.length > 0) {
          traverseComments(comment.replies);
        }
      }
    };
    traverseComments(allComments);

    const parentComment =
      currentComment.parentId !== null
        ? commentMap.get(currentComment.parentId)
        : null;

    const userMap = new Map<string, string>();
    const traverseCommentsForUserMap = (comments: CommentTree[]) => {
      for (const comment of comments) {
        const userName = comment.userName || comment.userEmail || comment.guestName || '';
        if (userName) {
          if (!userMap.has(userName)) {
            userMap.set(userName, comment.id);
          }
          if (comment.userEmail && !userMap.has(comment.userEmail)) {
            userMap.set(comment.userEmail, comment.id);
          }
          if (comment.guestName && !userMap.has(comment.guestName)) {
            userMap.set(comment.guestName, comment.id);
          }
        }
        if (comment.replies.length > 0) {
          traverseCommentsForUserMap(comment.replies);
        }
      }
    };
    traverseCommentsForUserMap(allComments);

    const sortedUserNames = Array.from(userMap.keys()).sort(
      (a, b) => b.length - a.length
    );

    let currentIndex = 0;
    while (currentIndex < content.length) {
      const atIndex = content.indexOf('@', currentIndex);
      if (atIndex === -1) {
        if (currentIndex < content.length) {
          parts.push(content.substring(currentIndex));
        }
        break;
      }

      if (atIndex > currentIndex) {
        parts.push(content.substring(currentIndex, atIndex));
      }

      let matched = false;
      for (const userName of sortedUserNames) {
        const mentionText = `@${userName}`;
        const nextCharIndex = atIndex + mentionText.length;

        if (
          content.substring(atIndex, nextCharIndex) === mentionText &&
          (nextCharIndex >= content.length || /\s/.test(content[nextCharIndex]))
        ) {
          let commentId = userMap.get(userName);

          if (
            parentComment &&
            (parentComment.userName === userName ||
              parentComment.userEmail === userName ||
              parentComment.guestName === userName)
          ) {
            commentId = parentComment.id;
          }

          if (commentId) {
            parts.push(
              <button
                key={atIndex}
                onClick={() => scrollToComment(commentId!)}
                className="text-blue-600 hover:underline font-semibold dark:text-blue-400"
              >
                {mentionText}
              </button>
            );
            currentIndex = nextCharIndex;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        parts.push('@');
        currentIndex = atIndex + 1;
      }
    }

    return parts.length > 0 ? parts : [content];
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm');
  };

  const getReplyCount = (comment: CommentTree): number => {
    let count = comment.replies.length;
    for (const reply of comment.replies) {
      count += getReplyCount(reply);
    }
    return count;
  };

  const flattenReplies = (replies: CommentTree[]): CommentTree[] => {
    const result: CommentTree[] = [];
    for (const reply of replies) {
      result.push(reply);
      if (reply.replies.length > 0) {
        result.push(...flattenReplies(reply.replies));
      }
    }
    return result.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  };

  const actionsRef = useRef<CommentActions>(null!);
  actionsRef.current = {
    handleCommentAction,
    handleDeleteComment,
    handleUpdateComment,
    handleReply,
    scrollToComment,
    parseMentions,
    findComment,
    setEditingId,
    setReplyingTo,
    toggleRepliesVisible: (commentId: string) => {
      setRepliesVisible((prev) => ({
        ...prev,
        [commentId]: prev[commentId] !== undefined ? !prev[commentId] : !defaultRepliesVisible,
      }));
    },
    setPage,
    formatDate,
    getReplyCount,
    flattenReplies,
    registerCommentRef: (commentId: string, el: HTMLDivElement | null) => {
      commentRefs.current[commentId] = el;
    },
  };

  return {
    user,
    data,
    comments,
    bestComments,
    pagination,
    loading,
    isPlaceholderData,
    page,
    setPage,
    currentUrl,
    replyingTo,
    editingId,
    repliesVisible,
    actionsRef,
    createPending: createCommentMutation.isPending,
    updatePending: updateCommentMutation.isPending,
    handleCreateComment,
    commentRefs,
  };
}
