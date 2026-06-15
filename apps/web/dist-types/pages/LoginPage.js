import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { BookOpen } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { APP_NAME } from '@unstpbl/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
export function LoginPage() {
    const location = useLocation();
    const { session, initialized } = useAuthStore();
    const state = location.state;
    const nextPath = state?.from?.pathname ?? '/';
    if (initialized && session) {
        return _jsx(Navigate, { to: nextPath, replace: true });
    }
    return (_jsx("main", { className: "min-h-screen bg-paper px-4 py-8 text-ink", children: _jsxs("section", { className: "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center", children: [_jsxs("div", { className: "mb-7 flex items-center gap-3", children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-lg bg-evergreen text-white", children: _jsx(BookOpen, { "aria-hidden": "true", size: 24 }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-evergreen", children: APP_NAME }), _jsx("p", { className: "text-sm font-medium text-ink/70", children: "Daily Verse" })] })] }), _jsx("div", { className: "rounded-lg border border-line bg-white p-5 shadow-soft", children: _jsx(Auth, { supabaseClient: supabase, appearance: {
                            theme: ThemeSupa,
                            variables: {
                                default: {
                                    colors: {
                                        brand: '#123c35',
                                        brandAccent: '#17211e',
                                        inputBorder: '#d9e3df',
                                        inputBorderFocus: '#123c35'
                                    },
                                    radii: {
                                        borderRadiusButton: '6px',
                                        inputBorderRadius: '6px'
                                    },
                                    fonts: {
                                        bodyFontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                                        buttonFontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                                        inputFontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                                        labelFontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
                                    }
                                }
                            },
                            className: {
                                button: 'min-h-11 font-semibold',
                                input: 'min-h-11',
                                label: 'font-semibold'
                            }
                        }, providers: [], redirectTo: window.location.origin }) })] }) }));
}
