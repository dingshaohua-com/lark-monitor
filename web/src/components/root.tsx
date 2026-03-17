import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { themeConfig } from '@/config/theme'
import SakuraEffect from '@/components/sakura-effect';

const fallback = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

export default function Root(): React.JSX.Element {
  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <div className="app-with-sakura" style={{ position: 'relative', minHeight: '100vh' }}>
        <SakuraEffect />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Suspense fallback={fallback}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </ConfigProvider>
  );
}
