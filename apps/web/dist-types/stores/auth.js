import { create } from 'zustand';
import { supabase } from '../lib/supabase';
function getRoleFromUser(user) {
    const role = user?.app_metadata?.role ??
        user?.user_metadata?.role ??
        user?.user_metadata?.user_role;
    return role === 'bishop' ? 'bishop' : 'member';
}
export const useAuthStore = create((set) => ({
    initialized: false,
    loading: true,
    session: null,
    user: null,
    role: 'member',
    initialize: () => {
        let active = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!active) {
                return;
            }
            set({
                initialized: true,
                loading: false,
                session: data.session,
                user: data.session?.user ?? null,
                role: getRoleFromUser(data.session?.user ?? null)
            });
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            set({
                initialized: true,
                loading: false,
                session,
                user: session?.user ?? null,
                role: getRoleFromUser(session?.user ?? null)
            });
        });
        return () => {
            active = false;
            subscription.unsubscribe();
        };
    },
    signOut: async () => {
        await supabase.auth.signOut();
        set({
            session: null,
            user: null,
            role: 'member'
        });
    }
}));
