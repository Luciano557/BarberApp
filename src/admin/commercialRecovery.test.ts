import { afterEach, describe, expect, it } from 'vitest';
import { readCommercialRecovery, rememberCommercialOperation, clearCommercialRecovery } from './commercialRecovery';
describe('commercial recovery', () => {
  afterEach(() => sessionStorage.clear());
  it('persists only a scoped ID/action and survives rereads', () => {
    const operation = { requestId: '33333333-3333-4333-8333-333333333333', action: 'update_details' as const };
    rememberCommercialOperation('actor-one', 'org-one', operation);
    expect(readCommercialRecovery('actor-one', 'org-one')).toEqual(operation);
    expect(readCommercialRecovery('actor-two', 'org-one')).toBeNull();
    expect(readCommercialRecovery('actor-one', 'org-two')).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!)).toEqual(operation);
    clearCommercialRecovery('actor-one', 'org-one'); expect(readCommercialRecovery('actor-one', 'org-one')).toBeNull();
  });
  it('ignores malformed or unknown recovery records', () => {
    sessionStorage.setItem('vittro:admin-commercial:actor:org', '{'); expect(readCommercialRecovery('actor', 'org')).toBeNull();
    sessionStorage.setItem('vittro:admin-commercial:actor:org', JSON.stringify({ requestId: 'not-an-id', action: 'delete_user' })); expect(readCommercialRecovery('actor', 'org')).toBeNull();
  });
});
