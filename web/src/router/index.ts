import { createHashRouter } from 'react-router';
import AdminLayout from '@/components/layout';
import Root from '@/components/root';
import { routes } from './routes';

const router = createHashRouter([
  {
    Component: Root,
    children: [
      {
        path: '/',
        Component: AdminLayout,
        children: routes,
      },
      {
        path: '/login',
        lazy: () => import('@/pages/login').then((m) => ({ Component: m.default })),
      },
    ],
  },
]);

export default router;
