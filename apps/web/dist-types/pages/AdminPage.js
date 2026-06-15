import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarPlus, Send, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
const dashboardItems = [
    {
        title: "Today's Verse",
        value: 'Psalm 119:105',
        icon: CalendarPlus
    },
    {
        title: 'Members',
        value: '0',
        icon: Users
    },
    {
        title: 'Dispatch',
        value: 'Not sent',
        icon: Send
    }
];
export function AdminPage() {
    return (_jsxs(Layout, { children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-normal text-moss", children: "Bishop Dashboard" }), _jsx("h1", { className: "mt-1 text-2xl font-bold text-evergreen", children: "Schedule" })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-3", children: dashboardItems.map((item) => {
                    const Icon = item.icon;
                    return (_jsxs("section", { className: "rounded-lg border border-line bg-white p-4 shadow-soft", children: [_jsx("div", { className: "mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-evergreen text-white", children: _jsx(Icon, { "aria-hidden": "true", size: 19 }) }), _jsx("p", { className: "text-sm font-semibold text-ink/70", children: item.title }), _jsx("p", { className: "mt-1 text-xl font-bold text-ink", children: item.value })] }, item.title));
                }) }), _jsxs("section", { className: "mt-5 rounded-lg border border-line bg-white p-4", children: [_jsx("h2", { className: "text-lg font-bold text-evergreen", children: "Manual Scheduling" }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-4", children: [_jsx("input", { className: "min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-evergreen", placeholder: "Book" }), _jsx("input", { className: "min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-evergreen", placeholder: "Chapter" }), _jsx("input", { className: "min-h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-evergreen", placeholder: "Verse" }), _jsxs("button", { type: "button", className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-evergreen px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink", children: [_jsx(CalendarPlus, { "aria-hidden": "true", size: 18 }), "Save"] })] })] })] }));
}
