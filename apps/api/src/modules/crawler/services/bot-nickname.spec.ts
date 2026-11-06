import { pickUnusedNickname, randomBotNickname } from './bot-nickname';

describe('봇 닉네임', () => {
  it('앞말+뒷말 조합이라 여러 번 뽑아도 같은 이름이 거의 반복되지 않는다', () => {
    const names = new Set(Array.from({ length: 50 }, () => randomBotNickname()));
    expect(names.size).toBeGreaterThan(40);
  });

  it('이미 쓴 이름은 피해서 고른다', () => {
    const seq = ['가', '가', '나'];
    expect(pickUnusedNickname(() => seq.shift()!, new Set(['가']))).toBe('나');
  });

  it('후보가 모두 이미 쓴 이름이면 정해진 횟수만 시도하고 마지막 후보를 쓴다', () => {
    const generate = jest.fn(() => '가');
    expect(pickUnusedNickname(generate, new Set(['가']), 5)).toBe('가');
    expect(generate).toHaveBeenCalledTimes(5);
  });
});
