import { Spin } from 'antd';
import { Suspense } from 'react';
import { Outlet } from 'react-router';

const fallback = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

export default function Root(): React.JSX.Element {
  return (
    <Suspense fallback={fallback}>
      <Outlet />
    </Suspense>
  );
}
