import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { themeConfig } from '@/config/theme';

const fallback = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

export default function Root(): React.JSX.Element {
  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <Suspense fallback={fallback}>
        <Outlet />
      </Suspense>
    </ConfigProvider>
  );
}
