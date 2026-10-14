export const UPLOAD_LIMITS = {
  // 최적화(WebP 변환·축소) 후 저장할 수 있는 최대 크기
  IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  // 받을 수 있는 원본 최대 크기. 변환 후 작아지는 큰 GIF(움짤)도 받되, 너무 큰 파일로 서버가 버거워지지 않게 막는다
  IMAGE_INPUT_SIZE: 30 * 1024 * 1024, // 30MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

export const IMAGE_PROCESSING = {
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1920,
  QUALITY: 80,
};
