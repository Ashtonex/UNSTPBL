import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@unstpbl/shared';
type AuthState = {
    initialized: boolean;
    loading: boolean;
    session: Session | null;
    user: User | null;
    role: UserRole;
    initialize: () => () => void;
    signOut: () => Promise<void>;
};
export declare const useAuthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState>>;
export {};
//# sourceMappingURL=auth.d.ts.map