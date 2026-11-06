import { buildCommentsRule, buildToneRule } from './prompt-rules';

const base = { title: '제목', content: '본문' };

describe('AI 지시 규칙', () => {
  it('리라이팅 톤앤매너는 게시글에만 적용한다', () => {
    expect(buildToneRule({ ...base, promptTone: '담담하게' })).toContain('지정된 톤(담담하게)을 게시글 제목과 본문에');
    expect(buildToneRule(base)).toContain('원본의 커뮤니티 구어체 톤을 유지');
  });

  it('댓글 지시문이 있으면 댓글 규칙에 그대로 넣는다', () => {
    const rule = buildCommentsRule({ ...base, generateComments: true, commentsCount: 2, commentPromptTone: ' 반말로 짧게 ' });
    expect(rule).toContain('정확히 2개');
    expect(rule).toContain('댓글에만 적용): 반말로 짧게');
    expect(rule).not.toContain('맛깔나는');
  });

  it('댓글 지시문이 없거나 비어 있으면 기본 댓글 문체', () => {
    expect(buildCommentsRule({ ...base, generateComments: true, commentsCount: 1 })).toContain('맛깔나는');
    expect(buildCommentsRule({ ...base, generateComments: true, commentsCount: 1, commentPromptTone: '  ' })).toContain('맛깔나는');
  });

  it('댓글을 만들지 않으면 댓글 규칙이 없다', () => {
    expect(buildCommentsRule({ ...base, generateComments: false, commentPromptTone: '반말' })).toBe('');
    expect(buildCommentsRule({ ...base, generateComments: true, commentsCount: 0 })).toBe('');
  });
});
