import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
export function ProtectedRoute({ children, requiredRole }) {
    const location = useLocation();
    const { initialized, session, role } = useAuthStore();
    if (!initialized) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-paper px-4 text-sm font-medium text-ink/70", children: "Loading" }));
    }
    if (!session) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location } });
    }
    if (requiredRole && role !== requiredRole) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return children;
}
