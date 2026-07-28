import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Heart, LayoutDashboard, Users, UserCheck, MessageSquare, BarChart3, Settings, UsersRound, Activity, BookOpen, MessagesSquare, Library } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { NAV_ITEMS, APP_CONFIG } from '@/lib/config';
import { isAdmin } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';

const ICON_MAP = {
  LayoutDashboard,
  Users,
  UserCheck,
  MessageSquare,
  BarChart3,
  Settings,
  UsersRound,
  Activity,
  BookOpen,
  MessagesSquare,
  Library,
};

function NavLinks({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = ICON_MAP[item.icon] || LayoutDashboard;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, [location.pathname]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin(user));

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Heart className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{APP_CONFIG.appName}</div>
            <div className="text-xs text-muted-foreground">{APP_CONFIG.ministry}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks items={navItems} />
        </div>
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{user?.full_name || 'User'}</div>
              <RoleBadge role={user?.role} />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Heart className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{APP_CONFIG.appName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <span className="font-semibold">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavLinks items={navItems} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}