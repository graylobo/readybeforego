'use client';

import React, { MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { CommentTree, CommentTargetType } from '@/lib/api/comments';
import { isAdmin } from '@community/shared-types';
import { CreateCommentDto } from '@community/shared-types';
import { CommentEditForm } from './comment-edit-form';
import { CommentForm } from './comment-form';
import { UserProfilePopover } from '@/components/common/user-profile-popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  ImageOff,
  MessageCircle,
  MoreVertical,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { SmartImage } from '@/components/common/smart-image';
import { EmoticonDetailsModal } from '@/components/emoticons/emoticon-details-modal';
import { ReportDialog } from '@/components/common/report-dialog';
import { TimeDisplay } from '@/components/common/time-display';

// ---- Types ----



export interface CommentActions {
  handleCommentAction: (id: string, action: 'upvote' | 'downvote') => void;
  handleDeleteComment: (id: string) => void;
  handleUpdateComment: (id: string, content: string, imageUrl?: string | null, emoticonUrl?: string | null) => void;
  handleReply: (dto: CreateCommentDto) => void;
  scrollToComment: (id: string) => void;
  parseMentions: (content: string, allComments: CommentTree[], currentComment: CommentTree) => React.ReactNode[];
  findComment: (commentsList: CommentTree[], id: string) => CommentTree | null;
  setEditingId: (id: string | null) => void;
  setReplyingTo: (id: string | null) => void;
  toggleRepliesVisible: (commentId: string) => void;
  setPage: (page: number) => void;
  formatDate: (dateString: string) => string;
  getReplyCount: (comment: CommentTree) => number;
  flattenReplies: (replies: CommentTree[]) => CommentTree[];
  registerCommentRef: (commentId: string, el: HTMLDivElement | null) => void;
}

export interface CommentItemProps {
  comment: CommentTree;
  allComments: CommentTree[];
  isTopLevel: boolean;
  isBest: boolean;
  isEditing: boolean;
  isReplying: boolean;
  isRepliesVisible: boolean;
  user: any;
  targetType: CommentTargetType;
  targetId: string;
  allowAnonymous: boolean;
  defaultRepliesVisible: boolean;
  page: number;
  createPending: boolean;
  updatePending: boolean;
  actionsRef: MutableRefObject<CommentActions>;
  commentRefCallback: (el: HTMLDivElement | null) => void;
  // For rendering child replies
  editingId: string | null;
  replyingTo: string | null;
  repliesVisible: Record<string, boolean>;
}

// ---- Helper: getCommentBranchCount ----
const getCommentBranchCount = (comment: CommentTree): number => {
  let count = 1;
  for (const reply of comment.replies) {
    count += getCommentBranchCount(reply);
  }
  return count;
};

// ---- Component ----

const 
CommentItem = React.memo(function CommentItem({
  comment,
  allComments,
  isTopLevel,
  isBest,
  isEditing,
  isReplying,
  isRepliesVisible,
  user,
  targetType,
  targetId,
  allowAnonymous,
  defaultRepliesVisible,
  page,
  createPending,
  updatePending,
  actionsRef,
  commentRefCallback,
  editingId,
  replyingTo,
  repliesVisible,
}: CommentItemProps) {
  const actions = actionsRef.current;
  const [showEmoticonDetails, setShowEmoticonDetails] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const isOwner = user && user.id === comment.userId;
  const isUserAdmin = isAdmin(user?.role);
  const isAnonymous = !comment.userId;
  const isReply = comment.parentId !== null;
  const hasReplies = comment.replies.length > 0;
  const replyCount = hasReplies ? actions.getReplyCount(comment) : 0;

  const uniqueKey = isBest ? `${comment.id}-best` : comment.id;

  return (
    <div
      id={isBest ? undefined : `comment-${comment.id}`}
      key={uniqueKey}
      ref={(el) => {
        if (!isBest) commentRefCallback(el);
      }}
      className={`py-2 ${isReply && !isBest ? 'ml-8' : ''} ${
        isBest
          ? 'bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-3 mb-2 border border-amber-200/50 dark:border-amber-700/30'
          : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {comment.userPicture ? (
          <UserProfilePopover
            userId={comment.userId}
            userName={comment.userName || comment.userEmail || '익명'}
            userPicture={comment.userPicture}
          >
            <img
              src={comment.userPicture}
              alt={comment.userName || 'User'}
              className="w-8 h-8 rounded-full hover:ring-2 hover:ring-primary transition-all shadow-sm object-cover"
            />
          </UserProfilePopover>
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex shrink-0 items-center justify-center text-xs font-bold text-muted-foreground shadow-sm">
            익
          </div>
        )}
        <div className="flex-1">
          <div
            className={`comment-content-${uniqueKey} transition-all duration-500`}
            style={{ padding: '0 0' }}
          >
            <div className="flex items-center gap-2 mb-1">
              {comment.userId ? (
                <UserProfilePopover
                  userId={comment.userId}
                  userName={comment.userName || comment.userEmail || '익명'}
                  userPicture={comment.userPicture}
                  className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer"
                >
                  {comment.userName || comment.userEmail || '익명'}
                </UserProfilePopover>
              ) : (
                <span className="font-semibold text-sm text-foreground/80">
                  {comment.guestName || '익명'}
                  {comment.ipAddress && (
                    <span className="ml-1 text-xs opacity-60">
                      ({(() => {
                        const cleaned = comment.ipAddress!.replace(/^.*:/, '');
                        const parts = cleaned.split('.');
                        if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
                        return cleaned;
                      })()})
                    </span>
                  )}
                </span>
              )}
              {isBest && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold rounded">
                  <Trophy className="w-3 h-3" /> BEST
                </span>
              )}
              <span className="text-xs text-gray-500">
                <TimeDisplay 
                  date={comment.createdAt}
                  formattedDate={actions.formatDate(comment.createdAt)}
                  defaultRelative={true}
                />
                {comment.updatedAt !== comment.createdAt && ' (수정됨)'}
              </span>
            </div>

            {isEditing ? (
              <CommentEditForm
                comment={comment}
                parentComment={comment.parentId ? actions.findComment(allComments, comment.parentId) : null}
                onSave={(content, imageUrl, emoticonUrl) => actions.handleUpdateComment(comment.id, content, imageUrl, emoticonUrl)}
                onCancel={() => actions.setEditingId(null)}
                isSaving={updatePending}
              />
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                <div className="flex-1 min-w-0">
                  {comment.isDeleted ? (
                    <p className="text-gray-400 italic">삭제된 댓글</p>
                  ) : (
                    <>
                      {comment.content && (
                        <p className="text-sm whitespace-pre-wrap">
                          {actions.parseMentions(comment.content, allComments, comment)}
                        </p>
                      )}
                      {(comment as any).emoticonUrl && (
                        <div className="mt-1.5">
                          <button 
                            type="button"
                            onClick={() => setShowEmoticonDetails(true)}
                            className="block group/emoticon relative cursor-pointer active:scale-95 transition-transform"
                          >
                            <SmartImage
                              src={(comment as any).emoticonUrl}
                              alt="emoticon"
                              className="max-w-[220px] max-h-[160px] object-contain rounded-xl border border-border/30 bg-muted/10 group-hover/emoticon:border-primary/50 group-hover/emoticon:bg-primary/5 transition-colors"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/emoticon:opacity-100 transition-opacity">
                                <div className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">이모티콘 정보</div>
                            </div>
                          </button>
                        </div>
                      )}
                      {(comment as any).imageUrl && (
                        <div className="mt-1.5">
                          <SmartImage
                            src={(comment as any).imageUrl}
                            alt="attached image"
                            className="max-w-[220px] max-h-[160px] object-contain rounded-xl border border-border/30 bg-muted/10 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open((comment as any).imageUrl, '_blank')}
                            fallbackClassName="w-[220px] h-[120px]"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!comment.isDeleted && !isBest && (
                  <div className="flex items-center gap-0.5 sm:mt-[-4px] shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => actions.handleCommentAction(comment.id, 'upvote')}
                        className={`h-8 px-2 gap-1 transition-all duration-200 active:scale-95 cursor-pointer group ${
                          comment.isUpvoted
                            ? 'text-blue-600 font-bold'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <ThumbsUp className={`h-3.5 w-3.5 transition-colors ${comment.isUpvoted ? 'fill-blue-600' : 'group-hover:stroke-blue-600'}`} />
                        {comment.upvoteCount > 0 && <span className="text-[12px]">{comment.upvoteCount}</span>}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => actions.handleCommentAction(comment.id, 'downvote')}
                        className={`h-8 px-2 gap-1 transition-all duration-200 active:scale-95 cursor-pointer group ${
                          comment.isDownvoted
                            ? 'text-red-600 font-bold'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <ThumbsDown className={`h-3.5 w-3.5 transition-colors ${comment.isDownvoted ? 'fill-red-600' : 'group-hover:stroke-red-600'}`} />
                        {comment.downvoteCount > 0 && <span className="text-[12px]">{comment.downvoteCount}</span>}
                      </Button>
                    </>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        actions.setReplyingTo(
                          replyingTo === comment.id ? null : comment.id
                        );
                      }}
                      className="h-8 px-2 cursor-pointer active:scale-95 transition-transform text-muted-foreground hover:bg-muted"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>

                    {!comment.isDeleted && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 cursor-pointer active:scale-95 transition-transform text-muted-foreground hover:bg-muted"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          {(isOwner || (isUserAdmin && !isAnonymous)) && (
                            <DropdownMenuItem
                              onClick={() => actions.setEditingId(comment.id)}
                              className="cursor-pointer py-2"
                            >
                              수정
                            </DropdownMenuItem>
                          )}

                          {(isOwner || isUserAdmin || isAnonymous) && (
                            <DropdownMenuItem
                              onClick={() => actions.handleDeleteComment(comment.id)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer py-2"
                            >
                              삭제
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() => setShowReportDialog(true)}
                            className="text-muted-foreground focus:bg-muted cursor-pointer py-2"
                          >
                            신고하기
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            )}


            {isBest && !comment.isDeleted && (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-sm text-blue-600 font-bold">
                  <ThumbsUp className="h-4 w-4 fill-blue-600" />
                  {comment.upvoteCount}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const targetPage = (comment as any).originalPage;
                    if (targetPage && targetPage !== page) {
                      actions.setPage(targetPage);
                    }
                    setTimeout(() => actions.scrollToComment(comment.id), 100);
                  }}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  댓글 위치로 가기
                </Button>
              </div>
            )}
            {hasReplies && isTopLevel && !isBest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actions.toggleRepliesVisible(comment.id)}
                className="h-8 text-blue-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                {isRepliesVisible ? (
                  <ChevronUp className="h-4 w-4 mr-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-1" />
                )}
                답글 {replyCount}개
              </Button>
            )}
            {isReplying && (
              <div className="mt-3">
                <CommentForm
                  targetId={targetId}
                  targetType={targetType}
                  parentId={comment.id}
                  onSubmit={actions.handleReply}
                  isPending={createPending}
                  onCancel={() => actions.setReplyingTo(null)}
                  allowAnonymous={allowAnonymous}
                  replyToName={comment.userName || comment.guestName || '익명'}
                />
              </div>
            )}
          </div>
          {/* 대댓글 렌더링 */}
          {hasReplies &&
            isTopLevel &&
            isRepliesVisible &&
            !isBest &&
            actions.flattenReplies(comment.replies).map((reply) => {
              const replyIsRepliesVisible =
                repliesVisible[reply.id] !== undefined
                  ? repliesVisible[reply.id]
                  : defaultRepliesVisible;
              return (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  allComments={allComments}
                  isTopLevel={false}
                  isBest={false}
                  isEditing={editingId === reply.id}
                  isReplying={replyingTo === reply.id}
                  isRepliesVisible={replyIsRepliesVisible}
                  user={user}
                  targetType={targetType}
                  targetId={targetId}
                  allowAnonymous={allowAnonymous}
                  defaultRepliesVisible={defaultRepliesVisible}
                  page={page}
                  createPending={createPending}
                  updatePending={updatePending}
                  actionsRef={actionsRef}
                  commentRefCallback={(el) => {
                    actions.registerCommentRef(reply.id, el);
                  }}
                  editingId={editingId}
                  replyingTo={replyingTo}
                  repliesVisible={repliesVisible}
                />
              );
            })}
        </div>
      </div>

      <EmoticonDetailsModal
        url={(comment as any).emoticonUrl}
        isOpen={showEmoticonDetails}
        onClose={() => setShowEmoticonDetails(false)}
      />

      <ReportDialog
        isOpen={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        targetType="COMMENT"
        targetId={comment.id}
      />
    </div>
  );
});

export default CommentItem;
