import { relations, sql } from 'drizzle-orm';
import { AnyPgColumn, bigint, boolean, doublePrecision, index, integer, json, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'moderator', 'admin', 'super_admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);
export const categoryTypeEnum = pgEnum('category_type', ['system', 'user']); // For Boards
export const reactionTypeEnum = pgEnum('reaction_type', ['like', 'dislike']);
export const emoticonStatusEnum = pgEnum('emoticon_status', ['pending', 'approved', 'rejected']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'resolved', 'rejected']);
export const scamScopeEnum = pgEnum('scam_scope', ['spot', 'region', 'city', 'country']);
export const reportTypeEnum = pgEnum('report_type', ['CAUTION', 'TIP', 'INFO']);

export const boardRequestStatusEnum = pgEnum('board_request_status', ['pending', 'approved', 'rejected']);
export const boardManagerRoleEnum = pgEnum('board_manager_role', ['manager', 'sub_manager']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique(),
  name: text('name').notNull().unique(),
  picture: text('picture'),
  googleId: text('google_id').unique(),
  kakaoId: text('kakao_id').unique(),
  naverId: text('naver_id').unique(),
  role: userRoleEnum('role').default('user').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  bannedUntil: timestamp('banned_until'),
  warningCount: integer('warning_count').default(0).notNull(),
  isProfileSetup: boolean('is_profile_setup').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    // 게시글 닉네임 검색(부분 일치)용. pg_trgm 확장 필요 (scripts/ensure-db-extensions.js)
    nameTrgmIdx: index('users_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
}));

// User points table
export const userPoints = pgTable('user_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  accumulatedPoints: integer('accumulated_points').default(0).notNull(), 
  availablePoints: integer('available_points').default(0).notNull(), 
  level: integer('level').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Point history table
export const pointHistory = pgTable('point_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  points: integer('points').notNull(),
  reason: text('reason').notNull(),
  relatedId: uuid('related_id'), 
  relatedType: text('related_type'), 
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('point_history_user_idx').on(table.userId),
  createdAtIdx: index('point_history_created_at_idx').on(table.createdAt),
}));

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['COMMENT', 'REPLY', 'LIKE', 'SYSTEM', 'MESSAGE'] }).notNull(),
  content: text('content').notNull(),
  targetId: uuid('target_id'), // post id, comment id, or message id
  targetType: text('target_type'), // 'POST', 'COMMENT', or 'MESSAGE'
  link: text('link'), // /board/free/123 형태의 이동 주소
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdReadIdx: index('notifications_user_read_idx').on(table.userId, table.isRead),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'user_notifications',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'actor_notifications',
  }),
}));

// Private Messages (Notes)
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: uuid('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  deletedBySender: boolean('deleted_by_sender').default(false).notNull(),
  deletedByReceiver: boolean('deleted_by_receiver').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  senderIdx: index('messages_sender_idx').on(table.senderId),
  receiverIdx: index('messages_receiver_idx').on(table.receiverId),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sent_messages',
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: 'received_messages',
  }),
}));


// Point policies table
export const pointPolicies = pgTable('point_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  actionType: text('action_type').notNull().unique(), 
  experiencePoints: integer('experience_points').notNull().default(0), 
  availablePoints: integer('available_points').notNull().default(0), 
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Boards table (e.g. Free, QnA)
export const boards = pgTable('boards', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(), // e.g. 'free', 'qna'
  name: text('name').notNull(),
  description: text('description'),
  type: categoryTypeEnum('type').default('system').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  allowAnonymous: boolean('allow_anonymous').default(false).notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  viewMode: text('view_mode').default('list').notNull(),
  // 읽기 전용: 글은 그대로 보이지만 새 글/댓글을 받지 않는다 (예: 운영이 끝난 게시판)
  isReadOnly: boolean('is_read_only').default(false).notNull(),
  // 게시판 화면에 매니저·부매니저 이름을 보여줄지 (매니저가 정함)
  showManagers: boolean('show_managers').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    slugIdx: index('boards_slug_idx').on(table.slug),
    sortOrderIdx: index('boards_sort_order_idx').on(table.sortOrder),
}));

// 게시판 개설 신청. 회원이 신청하고 사이트 관리자가 승인하면 게시판(type='user')이 생기고 신청자가 매니저가 된다
export const boardRequests = pgTable('board_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  reason: text('reason'),
  status: boardRequestStatusEnum('status').default('pending').notNull(),
  rejectReason: text('reject_reason'),
  reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('board_requests_status_idx').on(table.status, table.createdAt),
  requesterIdx: index('board_requests_requester_idx').on(table.requesterId, table.createdAt),
}));

// 게시판 관리자. 매니저 1명 + 부매니저(최대 3명)가 자기 게시판의 글/댓글 삭제, 공지·고정을 할 수 있다
export const boardManagers = pgTable('board_managers', {
  id: uuid('id').defaultRandom().primaryKey(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: boardManagerRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  boardUserUnique: uniqueIndex('board_managers_board_user_idx').on(table.boardId, table.userId),
  userIdx: index('board_managers_user_idx').on(table.userId),
}));

// Posts table
export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  boardId: uuid('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category'), 
  content: text('content').notNull(), 
  guestName: text('guest_name'),
  guestPassword: text('guest_password'),
  viewCount: integer('view_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  // 추천/비추천 수는 반응이 바뀔 때 함께 갱신해 두고, 조회 시 매번 집계하지 않는다
  likeCount: integer('like_count').default(0).notNull(),
  dislikeCount: integer('dislike_count').default(0).notNull(),
  // 목록에서 이미지 아이콘 표시용. 목록 조회 시 본문 전체를 읽지 않도록 저장 시점에 계산
  hasImage: boolean('has_image').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isNotice: boolean('is_notice').default(false).notNull(),
  isBest: boolean('is_best').default(false).notNull(),
  allowComments: boolean('allow_comments').default(true).notNull(),
  receiveCommentNotification: boolean('receive_comment_notification').default(true).notNull(),
  isBot: boolean('is_bot').default(false).notNull(),
  // Super Admin이 비공개로 돌린 시각. 값이 있으면 Super Admin만 보고, 다른 사람에게는 없는 글처럼 다룬다 (null이면 공개)
  hiddenAt: timestamp('hidden_at'),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
    boardIdx: index('posts_board_idx').on(table.boardId),
    deletedIdx: index('posts_deleted_at_idx').on(table.deletedAt),
    bestIdx: index('posts_best_idx').on(table.isBest, table.deletedAt, table.createdAt),
    boardListIdx: index('posts_board_list_idx').on(table.boardId, table.deletedAt, table.isNotice, table.isPinned, table.createdAt),
    userListIdx: index('posts_user_list_idx').on(table.userId, table.deletedAt, table.createdAt),
    // 전체/베스트 목록(여러 게시판)의 정렬용
    allListIdx: index('posts_all_list_idx')
      .on(table.isNotice, table.isPinned, table.createdAt)
      .where(sql`${table.deletedAt} is null`),
    // 사이트맵(사람이 쓴 글을 오래된 순으로 5만 개씩) 조회용. 글이 많아져도 정렬을 다시 하지 않는다
    sitemapIdx: index('posts_sitemap_idx')
      .on(table.createdAt, table.id)
      .where(sql`${table.deletedAt} is null and ${table.isBot} = false`),
    // 제목/내용/비회원 닉네임 검색(부분 일치)용. pg_trgm 확장 필요
    titleTrgmIdx: index('posts_title_trgm_idx').using('gin', table.title.op('gin_trgm_ops')),
    contentTrgmIdx: index('posts_content_trgm_idx').using('gin', table.content.op('gin_trgm_ops')),
    guestNameTrgmIdx: index('posts_guest_name_trgm_idx').using('gin', table.guestName.op('gin_trgm_ops')),
}));

// Comments table (Generic for posts, etc.)
export const comments = pgTable('comments', {
    id: uuid('id').defaultRandom().primaryKey(),
    targetId: text('target_id').notNull(), 
    targetType: text('target_type').notNull(), // 'post'
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    emoticonUrl: text('emoticon_url'),
    imageUrl: text('image_url'),
    guestName: text('guest_name'),
    guestPassword: text('guest_password'),
    ipAddress: text('ip_address'),
    // 추천/비추천 수 (반응이 바뀔 때 함께 갱신)
    likeCount: integer('like_count').default(0).notNull(),
    dislikeCount: integer('dislike_count').default(0).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    targetIdx: index('comments_target_idx').on(table.targetType, table.targetId),
    deletedIdx: index('comments_deleted_at_idx').on(table.deletedAt),
    targetCreatedIdx: index('comments_target_created_idx').on(table.targetType, table.targetId, table.createdAt),
    userCreatedIdx: index('comments_user_created_idx').on(table.userId, table.createdAt),
  }),
);

export const commentReactions = pgTable('comment_reactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'), // For anonymous reactions
    type: reactionTypeEnum('type').notNull(), // 'like' | 'dislike'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    // 한 사람(회원은 계정, 비회원은 IP)당 댓글 하나에 반응 하나만 허용
    commentUserUniq: uniqueIndex('comment_reactions_comment_user_uniq')
      .on(table.commentId, table.userId)
      .where(sql`${table.userId} is not null`),
    commentIpUniq: uniqueIndex('comment_reactions_comment_ip_uniq')
      .on(table.commentId, table.ipAddress)
      .where(sql`${table.userId} is null`),
}));

// Post Reactions (Like/Dislike)
export const postReactions = pgTable('post_reactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    ipAddress: text('ip_address'), // For anonymous reactions
    type: reactionTypeEnum('type').notNull(), // 'like' | 'dislike'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }, (table) => ({
      // 한 사람(회원은 계정, 비회원은 IP)당 게시글 하나에 반응 하나만 허용
      postUserUniq: uniqueIndex('post_reactions_post_user_uniq')
        .on(table.postId, table.userId)
        .where(sql`${table.userId} is not null`),
      postIpUniq: uniqueIndex('post_reactions_post_ip_uniq')
        .on(table.postId, table.ipAddress)
        .where(sql`${table.userId} is null`),
  })
);

export const postScraps = pgTable('post_scraps', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // 같은 글을 두 번 스크랩하지 않도록 고유 제약 + 내 스크랩 목록 정렬용
  userPostUniq: uniqueIndex('post_scraps_user_post_uniq').on(table.userId, table.postId),
  userCreatedIdx: index('post_scraps_user_created_idx').on(table.userId, table.createdAt),
}));


// User logs table (Login history, activities)
export const userLogs = pgTable('user_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'LOGIN', 'POST_CREATE', 'COMMENT_CREATE', 'LIKE', 'UPDATE_PROFILE'
  action: text('action').notNull(), // Human readable or key-based description
  targetId: uuid('target_id'), // Optional: ID of the targeted post, comment, etc.
  targetType: text('target_type'), // Optional: 'POST', 'COMMENT'
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTypeIdx: index('user_logs_user_type_idx').on(table.userId, table.type),
  createdAtIdx: index('user_logs_created_at_idx').on(table.createdAt),
}));

// User Moderation Logs (Warnings, Bans, Suspensions)
export const userModerationLogs = pgTable('user_moderation_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  adminId: uuid('admin_id').notNull().references(() => users.id),
  type: text('type').notNull(), // 'WARNING', 'SUSPENSION', 'BAN'
  reason: text('reason').notNull(),
  durationDays: integer('duration_days'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTypeIdx: index('user_moderation_logs_user_idx').on(table.userId),
}));

export const userModerationLogsRelations = relations(userModerationLogs, ({ one }) => ({
  user: one(users, {
    fields: [userModerationLogs.userId],
    references: [users.id],
    relationName: 'user_moderation',
  }),
  admin: one(users, {
    fields: [userModerationLogs.adminId],
    references: [users.id],
    relationName: 'admin_moderation',
  }),
}));

// Emoticons
export const emoticonPacks = pgTable('emoticon_packs', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url').notNull(),
  price: integer('price').notNull().default(0),
  status: emoticonStatusEnum('status').default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  salesCount: integer('sales_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
    statusIdx: index('emoticon_packs_status_idx').on(table.status),
    authorIdx: index('emoticon_packs_author_idx').on(table.authorId),
}));

export const emoticons = pgTable('emoticons', {
  id: uuid('id').defaultRandom().primaryKey(),
  packId: uuid('pack_id').notNull().references(() => emoticonPacks.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  name: text('name'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    packIdx: index('emoticons_pack_idx').on(table.packId),
}));

export const userEmoticonPacks = pgTable('user_emoticon_packs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => emoticonPacks.id, { onDelete: 'cascade' }),
  purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // optional expiration
}, (table) => ({
    userPackIdx: index('user_emoticons_user_pack_idx').on(table.userId, table.packId),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  userPoints: one(userPoints),
  pointHistory: many(pointHistory),
  posts: many(posts),
  comments: many(comments),
  logs: many(userLogs),
  moderationLogs: many(userModerationLogs, { relationName: 'user_moderation' }),
  performedModerations: many(userModerationLogs, { relationName: 'admin_moderation' }),
  sentMessages: many(messages, { relationName: 'sent_messages' }),
  receivedMessages: many(messages, { relationName: 'received_messages' }),
  receivedNotifications: many(notifications, { relationName: 'user_notifications' }),
  triggeredNotifications: many(notifications, { relationName: 'actor_notifications' }),
  scraps: many(postScraps),
  emoticonPacks: many(emoticonPacks),
  purchasedEmoticons: many(userEmoticonPacks),
  reports: many(reports, { relationName: 'user_reports' }),
  resolvedReports: many(reports, { relationName: 'resolved_reports' }),
  scamReactions: many(scamInfoReactions),
}));

export const userLogsRelations = relations(userLogs, ({ one }) => ({
  user: one(users, {
    fields: [userLogs.userId],
    references: [users.id],
  }),
}));

export const boardsRelations = relations(boards, ({ many }) => ({
    posts: many(posts),
    managers: many(boardManagers),
}));

export const boardManagersRelations = relations(boardManagers, ({ one }) => ({
    board: one(boards, { fields: [boardManagers.boardId], references: [boards.id] }),
    user: one(users, { fields: [boardManagers.userId], references: [users.id] }),
}));

export const boardRequestsRelations = relations(boardRequests, ({ one }) => ({
    requester: one(users, { fields: [boardRequests.requesterId], references: [users.id], relationName: 'boardRequestRequester' }),
    reviewer: one(users, { fields: [boardRequests.reviewedById], references: [users.id], relationName: 'boardRequestReviewer' }),
    board: one(boards, { fields: [boardRequests.boardId], references: [boards.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
    board: one(boards, {
        fields: [posts.boardId],
        references: [boards.id],
    }),
    user: one(users, {
        fields: [posts.userId],
        references: [users.id],
    }),
    reactions: many(postReactions),
    scraps: many(postScraps),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'replies',
  }),
  replies: many(comments, {
    relationName: 'replies',
  }),
  reactions: many(commentReactions),
}));

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
    comment: one(comments, {
        fields: [commentReactions.commentId],
        references: [comments.id],
    }),
    user: one(users, {
        fields: [commentReactions.userId],
        references: [users.id],
    }),
}));

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
    post: one(posts, {
        fields: [postReactions.postId],
        references: [posts.id],
    }),
    user: one(users, {
        fields: [postReactions.userId],
        references: [users.id],
    }),
}));

export const userPointsRelations = relations(userPoints, ({ one }) => ({
  user: one(users, {
    fields: [userPoints.userId],
    references: [users.id],
  }),
}));

export const pointHistoryRelations = relations(pointHistory, ({ one }) => ({
  user: one(users, {
    fields: [pointHistory.userId],
    references: [users.id],
  }),
}));

export const postScrapsRelations = relations(postScraps, ({ one }) => ({
  user: one(users, {
    fields: [postScraps.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postScraps.postId],
    references: [posts.id],
  }),
}));

export const emoticonPacksRelations = relations(emoticonPacks, ({ one, many }) => ({
  author: one(users, {
    fields: [emoticonPacks.authorId],
    references: [users.id],
  }),
  emoticons: many(emoticons),
  userPacks: many(userEmoticonPacks),
}));

export const emoticonsRelations = relations(emoticons, ({ one }) => ({
  pack: one(emoticonPacks, {
    fields: [emoticons.packId],
    references: [emoticonPacks.id],
  })
}));

export const userEmoticonPacksRelations = relations(userEmoticonPacks, ({ one }) => ({
  user: one(users, {
    fields: [userEmoticonPacks.userId],
    references: [users.id],
  }),
  pack: one(emoticonPacks, {
    fields: [userEmoticonPacks.packId],
    references: [emoticonPacks.id],
  })
}));

// Reports
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
  targetType: text('target_type').notNull(), // 'POST', 'COMMENT'
  targetId: uuid('target_id').notNull(),
  reason: text('reason').notNull(),
  status: reportStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: 'user_reports',
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
    relationName: 'resolved_reports',
  }),
}));

export const chatAuthorTypeEnum = pgEnum('chat_author_type', ['member', 'guest']);

// 실시간 채팅 메시지. room_slug로 채널을 구분하며, 핫패스는 Redis 최근 메시지 캐시를 사용한다.
// 대량 적재 시 (room_slug, created_at) 인덱스 기반 파티셔닝으로 확장한다.
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey(),
  roomSlug: text('room_slug').notNull().default('lobby'),
  authorType: chatAuthorTypeEnum('author_type').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  guestId: text('guest_id'),
  nickname: text('nickname').notNull(),
  content: text('content').notNull(),
  replyToId: uuid('reply_to_id').references((): AnyPgColumn => chatMessages.id, { onDelete: 'set null' }),
  replyToNickname: text('reply_to_nickname'),
  replyToContent: text('reply_to_content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  roomCreatedIdx: index('chat_messages_room_created_idx').on(table.roomSlug, table.createdAt),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  replyTo: one(chatMessages, {
    fields: [chatMessages.replyToId],
    references: [chatMessages.id],
  }),
}));

// 채팅 전용 설정. site_settings 계약을 깨지 않기 위해 분리한다.
export const chatSettings = pgTable('chat_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  enabled: boolean('enabled').default(true).notNull(),
  persistEnabled: boolean('persist_enabled').default(true).notNull(),
  showOnlineCount: boolean('show_online_count').default(false).notNull(),
  showMessageTime: boolean('show_message_time').default(false).notNull(),
  defaultOpen: boolean('default_open').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Site Settings (Singleton table)
export const siteSettings = pgTable('site_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  showSidebarAds: boolean('show_sidebar_ads').default(true).notNull(),
  // 사이드바 커뮤니티 메뉴의 '전체 게시판'·'게시판 목록' 표시 여부 (끄면 메뉴만 숨김, 주소로는 들어갈 수 있음)
  showAllBoardMenu: boolean('show_all_board_menu').default(true).notNull(),
  showBoardDirectoryMenu: boolean('show_board_directory_menu').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 수집 전체 공통 설정 (Singleton table)
export const crawlerSettings = pgTable('crawler_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  // 모든 카드에 공통으로 적용할 보존 단어 (카드별 보존 단어와 합쳐지며, 같은 단어는 카드 쪽 뜻이 우선)
  preservedTerms: text('preserved_terms'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Countries table
export const countries = pgTable('countries', {
  code: text('code').primaryKey(), // ISO 2-letter country code, e.g., 'TH', 'KR'
  name: text('name').notNull(),    // '태국', '대한민국'
  nameEn: text('name_en').notNull(), // 'Thailand', 'South Korea'
  emoji: text('emoji'),            // '🇹🇭', '🇰🇷'
  plug: text('plug'),              // '220V'
  visa: text('visa'),              // '무비자 90일'
  currency: text('currency'),      // '바트 (THB)'
  currencyCode: text('currency_code'), // 'THB'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Cities table
export const cities = pgTable('cities', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: text('country_code')
    .notNull()
    .references(() => countries.code, { onDelete: 'cascade' }),
  name: text('name').notNull(),    // '방콕', '서울'
  nameEn: text('name_en').notNull(), // 'Bangkok', 'Seoul'
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  countryIdx: index('cities_country_idx').on(table.countryCode),
}));

// Regions table (e.g., Khaosan Road)
export const regions = pgTable('regions', {
  id: uuid('id').defaultRandom().primaryKey(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),    // '카오산로드', '명동'
  nameEn: text('name_en').notNull(), // 'Khaosan Road', 'Myeongdong'
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  cityIdx: index('regions_city_idx').on(table.cityId),
}));

// Scam Infos table
export const scamInfos = pgTable('scam_infos', {
  id: uuid('id').defaultRandom().primaryKey(),
  regionId: uuid('region_id')
    .references(() => regions.id, { onDelete: 'cascade' }),
  cityId: uuid('city_id')
    .references(() => cities.id, { onDelete: 'cascade' }),
  countryCode: text('country_code')
    .references(() => countries.code, { onDelete: 'cascade' }),
  scope: scamScopeEnum('scope').default('spot').notNull(),
  reportType: reportTypeEnum('report_type').default('CAUTION').notNull(), // 'CAUTION' (주의/위험) | 'TIP' (사전 꿀팁) | 'INFO' (일반)
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  avoidanceTip: text('avoidance_tip'),
  subLocation: text('sub_location'),
  scamCategory: text('scam_category').notNull(),
  otherCategoryNote: text('other_category_note'), // OTHER 선택 시 한 줄 성격 설명 (운영 승격용)
  audienceNationalities: text('audience_nationalities'), // 특정 국적 한정 시 ISO 코드 CSV (비어있으면 모든 여행자)
  sourceUrl: text('source_url'),
  imageUrls: json('image_urls'),
  viewCount: integer('view_count').default(0).notNull(),
  upvoteCount: integer('upvote_count').default(0).notNull(),
  downvoteCount: integer('downvote_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  regionIdx: index('scam_infos_region_idx').on(table.regionId),
  cityIdx: index('scam_infos_city_idx').on(table.cityId),
  countryIdx: index('scam_infos_country_idx').on(table.countryCode),
  typeIdx: index('scam_infos_report_type_idx').on(table.reportType),
  upvoteIdx: index('scam_infos_upvote_idx').on(table.upvoteCount),
  userScaleIdx: index('scam_infos_user_idx').on(table.userId),
}));

// Scam Info Reactions table
export const scamInfoReactions = pgTable('scam_info_reactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  scamInfoId: uuid('scam_info_id')
    .notNull()
    .references(() => scamInfos.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address'),
  type: reactionTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  scamUserIdx: index('scam_info_reactions_idx').on(table.scamInfoId, table.userId, table.ipAddress),
}));

// Relations
export const countriesRelations = relations(countries, ({ many }) => ({
  cities: many(cities),
  scamInfos: many(scamInfos),
}));

export const citiesRelations = relations(cities, ({ one, many }) => ({
  country: one(countries, {
    fields: [cities.countryCode],
    references: [countries.code],
  }),
  regions: many(regions),
  scamInfos: many(scamInfos),
}));

export const regionsRelations = relations(regions, ({ one, many }) => ({
  city: one(cities, {
    fields: [regions.cityId],
    references: [cities.id],
  }),
  scamInfos: many(scamInfos),
}));

export const scamInfosRelations = relations(scamInfos, ({ one, many }) => ({
  region: one(regions, {
    fields: [scamInfos.regionId],
    references: [regions.id],
  }),
  city: one(cities, {
    fields: [scamInfos.cityId],
    references: [cities.id],
  }),
  country: one(countries, {
    fields: [scamInfos.countryCode],
    references: [countries.code],
  }),
  reactions: many(scamInfoReactions),
  user: one(users, {
    fields: [scamInfos.userId],
    references: [users.id],
  }),
}));

// Crawler Target Galleries (외부 커뮤니티 수집 대상 설정)
export const crawlerTargets = pgTable('crawler_targets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  sourceType: text('source_type').default('dcinside').notNull(),
  galleryId: text('gallery_id').notNull(),
  targetBoardId: uuid('target_board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  category: text('category'),
  minRecommendCount: integer('min_recommend_count').default(0).notNull(),
  botUserId: uuid('bot_user_id').references(() => users.id, { onDelete: 'set null' }),
  promptTone: text('prompt_tone').default('natural'),
  // 패러프레이징 시 그대로 유지할 단어 (쉼표/줄바꿈 구분, "단어=뜻" 형식 가능. 예: 광상=광우상사, 잉여햄)
  preservedTerms: text('preserved_terms'),
  // 제목이나 본문에 들어 있으면 수집하지 않을 단어 (쉼표/줄바꿈 구분. 대소문자·띄어쓰기 무시)
  excludeKeywords: text('exclude_keywords'),
  isActive: boolean('is_active').default(true).notNull(),
  collectLimit: integer('collect_limit').default(5).notNull(),
  enableComments: boolean('enable_comments').default(true).notNull(),
  commentsCount: integer('comments_count').default(2).notNull(),
  commentsCountMin: integer('comments_count_min').default(0).notNull(),
  commentsCountMax: integer('comments_count_max').default(3).notNull(),
  viewCountMin: integer('view_count_min').default(5).notNull(),
  viewCountMax: integer('view_count_max').default(15).notNull(),
  includeImages: boolean('include_images').default(true).notNull(),
  authorMainKeywords: text('author_main_keywords'),
  authorSubKeywords: text('author_sub_keywords'),
  authorUseSub: boolean('author_use_sub').default(false).notNull(),
  commentAuthorMainKeywords: text('comment_author_main_keywords'),
  commentAuthorSubKeywords: text('comment_author_sub_keywords'),
  commentAuthorUseSub: boolean('comment_author_use_sub').default(false).notNull(),
  timeJitterMinMinutes: integer('time_jitter_min_minutes').default(10).notNull(),
  timeJitterMaxMinutes: integer('time_jitter_max_minutes').default(120).notNull(),
  // 등록 순서: 'ordered'(디시 순서대로) | 'shuffled'(글마다 시각을 따로 뽑아 섞음). 실시간 등록이면 항상 순서대로
  postOrderMode: text('post_order_mode').default('ordered').notNull(),
  // 켠 이후 올라온 글만 수집: 켜는 순간 디시 최신 글 번호를 new_posts_after_id에 적어 두고 그보다 큰 번호만 가져온다
  onlyNewPosts: boolean('only_new_posts').default(false).notNull(),
  newPostsAfterId: bigint('new_posts_after_id', { mode: 'number' }),
  // 수집 방향: 'newest'(1페이지부터, 최신 글부터) | 'oldest'(끝 페이지 아래쪽부터, 예전 글부터)
  crawlDirection: text('crawl_direction').default('newest').notNull(),
  pageMin: integer('page_min').default(1).notNull(),
  pageMax: integer('page_max').default(3).notNull(),
  // 수집 주기 범위(분): 최소(crawl_interval_minutes)~최대. 최대가 없으면 고정 주기
  crawlIntervalMinutes: integer('crawl_interval_minutes').default(10).notNull(),
  crawlIntervalMaxMinutes: integer('crawl_interval_max_minutes'),
  autoStopMinutes: integer('auto_stop_minutes').default(0).notNull(),
  activatedAt: timestamp('activated_at'),
  lastCrawledAt: timestamp('last_crawled_at'),
  // 다음 정기 수집 시각 (수집할 때마다 주기 범위에서 무작위로 정한다. 비어 있으면 바로 수집)
  nextCrawlAt: timestamp('next_crawl_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  targetBoardIdx: index('crawler_targets_board_idx').on(table.targetBoardId),
  galleryIdIdx: index('crawler_targets_gallery_idx').on(table.sourceType, table.galleryId),
}));

export const crawlerTargetsRelations = relations(crawlerTargets, ({ one }) => ({
  targetBoard: one(boards, {
    fields: [crawlerTargets.targetBoardId],
    references: [boards.id],
  }),
  botUser: one(users, {
    fields: [crawlerTargets.botUserId],
    references: [users.id],
  }),
}));

export const scamInfoReactionsRelations = relations(scamInfoReactions, ({ one }) => ({
  scamInfo: one(scamInfos, {
    fields: [scamInfoReactions.scamInfoId],
    references: [scamInfos.id],
  }),
  user: one(users, {
    fields: [scamInfoReactions.userId],
    references: [users.id],
  }),
}));

// Country Guides table (가이드 및 준비물)
export const countryGuides = pgTable('country_guides', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: text('country_code')
    .notNull()
    .references(() => countries.code, { onDelete: 'cascade' }),
  cityId: uuid('city_id')
    .references(() => cities.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // 'pre_travel' | 'essentials' | 'baggage' | 'tips'
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon'),
  isRequired: boolean('is_required').default(false).notNull(),
  isCheckable: boolean('is_checkable').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  countryIdx: index('country_guides_country_idx').on(table.countryCode),
  cityIdx: index('country_guides_city_idx').on(table.cityId),
  categoryIdx: index('country_guides_category_idx').on(table.category),
}));

export const countryGuidesRelations = relations(countryGuides, ({ one }) => ({
  country: one(countries, {
    fields: [countryGuides.countryCode],
    references: [countries.code],
  }),
  city: one(cities, {
    fields: [countryGuides.cityId],
    references: [cities.id],
  }),
}));

// Crawler Logs (수집 이력 및 중복 수집 방지)
export const crawlerLogs = pgTable('crawler_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  // 수집 대상 카드가 삭제돼도 이력(과 연결된 게시글)은 남도록 연결만 끊는다
  targetId: uuid('target_id').references(() => crawlerTargets.id, { onDelete: 'set null' }),
  // 수집 당시 카드 이름 (카드 삭제 후에도 출처 표시용)
  targetName: text('target_name'),
  sourcePostId: text('source_post_id').notNull(),
  sourceUrl: text('source_url').notNull(),
  originalTitle: text('original_title').notNull(),
  createdPostId: uuid('created_post_id').references(() => posts.id, { onDelete: 'set null' }),
  status: text('status').notNull(), // 'SUCCESS' | 'FAILED' | 'SKIPPED'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  targetSourceIdx: index('crawler_logs_target_source_idx').on(table.targetId, table.sourcePostId),
  sourcePostIdx: index('crawler_logs_source_post_idx').on(table.sourcePostId),
  createdAtIdx: index('crawler_logs_created_at_idx').on(table.createdAt),
}));

export const crawlerLogsRelations = relations(crawlerLogs, ({ one }) => ({
  target: one(crawlerTargets, {
    fields: [crawlerLogs.targetId],
    references: [crawlerTargets.id],
  }),
  createdPost: one(posts, {
    fields: [crawlerLogs.createdPostId],
    references: [posts.id],
  }),
}));


