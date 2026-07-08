/**
 * 전역 에러 코드 정의
 */
export enum ErrorCode {
  // 공통
  INTERNAL_SERVER_ERROR = 'COMMON_001',
  INVALID_INPUT = 'COMMON_002',
  UNAUTHORIZED = 'COMMON_003',
  FORBIDDEN = 'COMMON_004',
  NOT_FOUND = 'COMMON_005',
  USER_NOT_FOUND = 'COMMON_007',
  TOO_MANY_REQUESTS = 'COMMON_006',

  // 인증
  AUTH_INVALID_TOKEN = 'AUTH_001',
  AUTH_EXPIRED_TOKEN = 'AUTH_002',
  AUTH_REQUIRED = 'AUTH_003',

  // 게시판/게시글
  BOARD_NOT_FOUND = 'BOARD_001',
  POST_NOT_FOUND = 'POST_001',
  POST_INVALID_PASSWORD = 'POST_002',
  POST_PERMISSION_DENIED = 'POST_003',

  // 댓글
  COMMENT_NOT_FOUND = 'COMMENT_001',
  COMMENT_INVALID_PASSWORD = 'COMMENT_002',

  // 파일/업로드
  UPLOAD_FAILED = 'UPLOAD_001',
  FILE_TOO_LARGE = 'UPLOAD_002',
  INVALID_FILE_TYPE = 'UPLOAD_003',

  // 이모티콘
  RESOURCE_NOT_FOUND = 'RESOURCE_001',
  FORBIDDEN_ACTION = 'RESOURCE_002',
  NOT_ENOUGH_POINTS = 'POINT_001',
  EMOTICON_ALREADY_PURCHASED = 'EMOTICON_001',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  // 공통
  [ErrorCode.INTERNAL_SERVER_ERROR]: '서버 내부 오류가 발생했습니다.',
  [ErrorCode.INVALID_INPUT]: '입력값이 올바르지 않습니다.',
  [ErrorCode.UNAUTHORIZED]: '인증이 필요합니다.',
  [ErrorCode.FORBIDDEN]: '권한이 없습니다.',
  [ErrorCode.NOT_FOUND]: '요청하신 리소스를 찾을 수 없습니다.',
  [ErrorCode.USER_NOT_FOUND]: '사용자를 찾을 수 없습니다.',
  [ErrorCode.TOO_MANY_REQUESTS]: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',

  // 인증
  [ErrorCode.AUTH_INVALID_TOKEN]: '유효하지 않은 토큰입니다.',
  [ErrorCode.AUTH_EXPIRED_TOKEN]: '만료된 토큰입니다.',
  [ErrorCode.AUTH_REQUIRED]: '로그인이 필요한 서비스입니다.',

  // 게시판/게시글
  [ErrorCode.BOARD_NOT_FOUND]: '게시판을 찾을 수 없습니다.',
  [ErrorCode.POST_NOT_FOUND]: '게시글을 찾을 수 없습니다.',
  [ErrorCode.POST_INVALID_PASSWORD]: '비밀번호가 일치하지 않습니다.',
  [ErrorCode.POST_PERMISSION_DENIED]: '게시글에 대한 권한이 없습니다.',

  // 댓글
  [ErrorCode.COMMENT_NOT_FOUND]: '댓글을 찾을 수 없습니다.',
  [ErrorCode.COMMENT_INVALID_PASSWORD]: '비밀번호가 일치하지 않습니다.',

  // 파일/업로드
  [ErrorCode.UPLOAD_FAILED]: '파일 업로드에 실패했습니다.',
  [ErrorCode.FILE_TOO_LARGE]: '파일 크기가 너무 큽니다.',
  [ErrorCode.INVALID_FILE_TYPE]: '지원하지 않는 파일 형식입니다.',

  // 이모티콘
  [ErrorCode.RESOURCE_NOT_FOUND]: '리소스를 찾을 수 없습니다.',
  [ErrorCode.FORBIDDEN_ACTION]: '해당 작업을 수행할 권한이 없습니다.',
  [ErrorCode.NOT_ENOUGH_POINTS]: '포인트가 부족합니다.',
  [ErrorCode.EMOTICON_ALREADY_PURCHASED]: '이미 구매한 이모티콘 팩입니다.',
};
