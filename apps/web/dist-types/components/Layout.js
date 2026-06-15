import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Home, LogOut, Shield } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { APP_NAME } from '@unstpbl/shared';
import { useAuthStore } from '../stores/auth';
const navLinkClass = ({ isActive }) => [
    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
    isActive
        ? 'bg-evergreen text-white'
        : 'text-ink/70 hover:bg-evergreen/10 hover:text-evergreen'
].join(' ');
export function Layout({ children }) {
    const { role, signOut } = useAuthStore();
    return (_jsxs("div", { className: "min-h-screen bg-paper text-ink", children: [_jsx("header", { className: "border-b border-line bg-white", children: _jsxs("div", { className: "mx-auto flex max-w-5xl items-center justify-between px-4 py-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-normal text-moss", children: APP_NAME }), _jsx("p", { className: "text-sm font-medium text-ink/70", children: "Daily Verse" })] }), _jsx("button", { type: "button", onClick: () => void signOut(), className: "inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-ink/70 transition hover:border-evergreen hover:text-evergreen", "aria-label": "Sign out", title: "Sign out", children: _jsx(LogOut, { "aria-hidden": "true", size: 18 }) })] }) }), _jsx("main", { className: "mx-auto min-h-[calc(100vh-145px)] max-w-5xl px-4 py-5 sm:py-8", children: children }), _jsx("nav", { className: "sticky bottom-0 border-t border-line bg-white/95 px-3 py-3 backdrop-blur", children: _jsxs("div", { className: "mx-auto flex max-w-md gap-2", children: [_jsxs(NavLink, { to: "/", className: navLinkClass, end: true, children: [_jsx(Home, { "aria-hidden": "true", size: 18 }), "Home"] }), role === 'bishop' ? (_jsxs(NavLink, { to: "/admin", className: navLinkClass, children: [_jsx(Shield, { "aria-hidden": "true", size: 18 }), "Admin"] })) : null] }) })] }));
}
