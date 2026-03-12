import { lazy } from 'react'
import { createHashRouter } from 'react-router'
import Root from '@/components/root'

const router = createHashRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: lazy(() => import('@/pages/home')) },
      { path: '/about', Component: lazy(() => import('@/pages/about')) },
      { path: '/user', Component: lazy(() => import('@/pages/user')) }
    ]
  }
])

export default router