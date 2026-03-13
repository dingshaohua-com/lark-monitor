import { FundViewOutlined, HomeOutlined, ReadOutlined, SettingOutlined, SyncOutlined, TeamOutlined } from '@ant-design/icons';
import { lazy } from 'react';
import type { RouteObject } from 'react-router';

export type RouteMeta = {
  title: string;
  icon?: React.ReactNode;
  hideInMenu?: boolean;
};

export type AppRoute = RouteObject & {
  meta?: RouteMeta;
  children?: AppRoute[];
};

export const routes: AppRoute[] = [
  // {
  //   index: true,
  //   meta: { title: '首页', icon: <HomeOutlined /> },
  //   Component: lazy(() => import('@/pages/home')),
  // },
  {
    index: true,
    meta: { title: '数据分析', icon: <FundViewOutlined /> },
    Component: lazy(() => import('@/pages/home')),
  },
  {
    path: 'lark-msg',
    meta: { title: '飞书消息', icon:<ReadOutlined /> },
    Component: lazy(() => import('@/pages/lark-msg')),
  },
  // {
  //   path: 'work-order',
  //   meta: { title: '工单列表', icon:<ReadOutlined /> },
  //   Component: lazy(() => import('@/pages/work-order')),
  // },
 
  {
    path: 'system',
    meta: { title: '系统管理', icon: <SettingOutlined /> },
    children: [
      {
        path: 'sync',
        meta: { title: '数据同步', icon:<SyncOutlined /> },
        Component: lazy(() => import('@/pages/sync')),
      },
    ],
  },
];
