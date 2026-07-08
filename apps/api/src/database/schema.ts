import { relations } from 'drizzle-orm';
import { AnyPgColumn, boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid, doublePrecision, json } from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'moderator', 'admin', 'super_admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);
export const categoryTypeEnum = pgEnum('category_type', ['system', 'user']); // For Boards
export const reactionTypeEnum = pgEnum('reaction_type', ['like', 'dislike']);
export const emoticonStatusEnum = pgEnum('emoticon_status', ['pending', 'approved', 'rejected']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'resolved', 'rejected']);

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
});

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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    slugIdx: index('boards_slug_idx').on(table.slug),
    sortOrderIdx: index('boards_sort_order_idx').on(table.sortOrder),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isNotice: boolean('is_notice').default(false).notNull(),
  isBest: boolean('is_best').default(false).notNull(),
  allowComments: boolean('allow_comments').default(true).notNull(),
  receiveCommentNotification: boolean('receive_comment_notification').default(true).notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
    boardIdx: index('posts_board_idx').on(table.boardId),
    deletedIdx: index('posts_deleted_at_idx').on(table.deletedAt),
    bestIdx: index('posts_best_idx').on(table.isBest, table.deletedAt, table.createdAt),
    boardListIdx: index('posts_board_list_idx').on(table.boardId, table.deletedAt, table.isNotice, table.isPinned, table.createdAt),
    userListIdx: index('posts_user_list_idx').on(table.userId, table.deletedAt, table.createdAt),
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
    commentUserIdx: index('comment_reactions_comment_user_idx').on(table.commentId, table.userId, table.ipAddress),
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
      postUserIdx: index('post_reactions_post_user_idx').on(table.postId, table.userId, table.ipAddress),
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
  userPostIdx: index('post_scraps_user_post_idx').on(table.userId, table.postId),
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

// Site Settings (Singleton table)
export const siteSettings = pgTable('site_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  showSidebarAds: boolean('show_sidebar_ads').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Countries table
export const countries = pgTable('countries', {
  code: text('code').primaryKey(), // ISO 2-letter country code, e.g., 'TH', 'KR'
  name: text('name').notNull(),    // '태국', '대한민국'
  nameEn: text('name_en').notNull(), // 'Thailand', 'South Korea'
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
    .notNull()
    .references(() => regions.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  avoidanceTip: text('avoidance_tip'),
  scamCategory: text('scam_category').notNull(),
  sourceUrl: text('source_url'),
  imageUrls: json('image_urls'), // 다중 이미지 URL 저장을 위한 JSON 컬럼 추가
  viewCount: integer('view_count').default(0).notNull(),
  upvoteCount: integer('upvote_count').default(0).notNull(),
  downvoteCount: integer('downvote_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  regionIdx: index('scam_infos_region_idx').on(table.regionId),
  upvoteIdx: index('scam_infos_upvote_idx').on(table.upvoteCount),
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
}));

export const citiesRelations = relations(cities, ({ one, many }) => ({
  country: one(countries, {
    fields: [cities.countryCode],
    references: [countries.code],
  }),
  regions: many(regions),
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
  reactions: many(scamInfoReactions),
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

