jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { USER_ROLES } from '@community/shared-types';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GuidesController } from '../guides/guides.controller';
import { ScamsController } from './scams.controller';

// 경로가 admin으로 시작하는 API는 모두 관리자 권한을 요구해야 한다 (새 API를 추가할 때 빠뜨리지 않도록)
describe.each([
  ['ScamsController', ScamsController],
  ['GuidesController', GuidesController],
])('%s 관리자 API', (_name, controller) => {
  const proto = controller.prototype as unknown as Record<string, object>;
  const adminHandlers = Object.getOwnPropertyNames(proto)
    .filter((key) => key !== 'constructor')
    .filter((key) => String(Reflect.getMetadata('path', proto[key]) ?? '').startsWith('admin'));

  it('관리자 API가 5개 이상 있다', () => {
    expect(adminHandlers.length).toBeGreaterThanOrEqual(5);
  });

  it.each(adminHandlers)('%s: RolesGuard와 ADMIN 역할을 요구한다', (key) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, proto[key])).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, proto[key])).toEqual([USER_ROLES.ADMIN]);
  });
});
