import type { Role } from './types';

export const dashboardMenu: Record<Role, { id: string; name: string }[]> = {
  user: [
    { id: 'overview', name: 'My gallery' },
    { id: 'purchases', name: 'Purchase history' },
    { id: 'collection', name: 'My collection' },
    { id: 'membership', name: 'Membership' },
    { id: 'profile', name: 'My profile' },
  ],
  artist: [
    { id: 'overview', name: 'Studio overview' },
    { id: 'artworks', name: 'My artworks' },
    { id: 'sales', name: 'Sales history' },
    { id: 'profile', name: 'My profile' },
  ],
  admin: [
    { id: 'overview', name: 'Platform overview' },
    { id: 'users', name: 'Manage users' },
    { id: 'artworks', name: 'All artworks' },
    { id: 'transactions', name: 'All transactions' },
    { id: 'profile', name: 'My profile' },
  ],
};

export function dashboardHref(role: Role, tab = 'overview') {
  return `/dashboard/${role}${tab === 'overview' ? '' : `?tab=${tab}`}`;
}
