import type { ReactNode } from 'react';
import type { UserRole } from '@unstpbl/shared';
type ProtectedRouteProps = {
    children: ReactNode;
    requiredRole?: UserRole;
};
export declare function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps): string | number | boolean | import("react/jsx-runtime").JSX.Element | Iterable<ReactNode> | null | undefined;
export {};
//# sourceMappingURL=ProtectedRoute.d.ts.map