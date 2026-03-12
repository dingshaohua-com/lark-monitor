import { NavLink, Outlet } from 'react-router'

const navItems = [
  { to: '/', label: '首页' },
  { to: '/user', label: '用户管理' },
  { to: '/about', label: '关于' },
]

export default function Root() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center gap-6 px-6 h-14 bg-white border-b border-gray-200">
        <span className="font-semibold text-lg mr-4">MyApp</span>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `text-sm transition-colors ${isActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-500'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
