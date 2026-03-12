import type { MenuProps } from 'antd';
import type { AppRoute } from './routes';

function resolvePath(parent: string, route: AppRoute) {
  if (route.index) return parent === '/' ? '/' : parent;
  return `${parent === '/' ? '' : parent}/${route.path}`;
}

/** 生成 antd Menu 的 items */
export function toMenuItems(appRoutes: AppRoute[], parentPath = '/'): MenuProps['items'] {
  return appRoutes
    .filter((r) => !r.meta?.hideInMenu)
    .map((route) => {
      const fullPath = resolvePath(parentPath, route);
      return {
        key: fullPath,
        icon: route.meta?.icon,
        label: route.meta?.title,
        ...(route.children ? { children: toMenuItems(route.children, fullPath) } : {}),
      };
    });
}

/** 生成 path → title 的映射 */
export function toBreadcrumbMap(appRoutes: AppRoute[], parentPath = '/', map: Record<string, string> = {}) {
  for (const route of appRoutes) {
    const fullPath = resolvePath(parentPath, route);
    if (route.meta?.title) map[fullPath] = route.meta.title;
    if (route.children) toBreadcrumbMap(route.children, fullPath, map);
  }
  return map;
}

/** 收集所有有 Component 的路径（可导航） */
export function toRoutableSet(appRoutes: AppRoute[], parentPath = '/', set = new Set<string>()) {
  for (const route of appRoutes) {
    const fullPath = resolvePath(parentPath, route);
    if (route.Component) set.add(fullPath);
    if (route.children) toRoutableSet(route.children, fullPath, set);
  }
  return set;
}
