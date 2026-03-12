import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Breadcrumb, Dropdown, Layout, Menu, type MenuProps, theme } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { toBreadcrumbMap, toMenuItems, toRoutableSet } from '@/router/helper';
import { routes } from '@/router/routes';

const { Header, Sider, Content } = Layout;

const menuItems = toMenuItems(routes);
const breadcrumbNameMap = toBreadcrumbMap(routes);
const routablePaths = toRoutableSet(routes);

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const pathSnippets = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems =
    pathSnippets.length === 0
      ? [{ title: '首页', key: '/' }]
      : pathSnippets.map((_, index) => {
          const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
          return {
            title: breadcrumbNameMap[url] ?? url,
            ...(routablePaths.has(url) ? { href: `#${url}` } : {}),
            key: url,
          };
        });

  const userMenuItems: MenuProps['items'] = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      navigate('/login');
    }
  };

  const selectedKeys = [location.pathname === '/' ? '/' : location.pathname];
  const openKeys = menuItems
    ?.filter((item): item is Extract<typeof item, { children: unknown }> => !!(item && 'children' in item))
    .filter((item) => (item.children as MenuProps['items'])?.some((child) => child && 'key' in child && selectedKeys.includes(child.key as string)))
    .map((item) => item.key as string) ?? [];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={220}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            gap: 8,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            夕
          </div>
          {!collapsed && <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>工单平台</span>}
        </div>

        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={onMenuClick}
          style={{ border: 'none', padding: '8px 0' }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            height: 56,
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer', fontSize: 16, display: 'flex' }}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <Dropdown menu={{ items: userMenuItems, onClick: onUserMenuClick }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span style={{ fontSize: 14 }}>Admin</span>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
