import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';
import { Layout } from '../components/Layout';
import { VerseCard } from '../components/VerseCard';
async function fetchTodayVerse() {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/verses/today`);
    if (!response.ok) {
        throw new Error('Unable to load today verse');
    }
    const body = (await response.json());
    return body.data;
}
export function HomePage() {
    const [markedRead, setMarkedRead] = useState(false);
    const { data, isError, isLoading } = useQuery({
        queryKey: ['today-verse'],
        queryFn: fetchTodayVerse,
        retry: 1
    });
    const verse = data ?? {
        ...DEFAULT_FALLBACK_VERSE,
        date: new Date().toISOString().slice(0, 10)
    };
    return (_jsx(Layout, { children: _jsxs("div", { className: "grid gap-5 lg:grid-cols-[1fr_320px]", children: [_jsxs("div", { className: "space-y-4", children: [isError ? (_jsx("div", { className: "rounded-md border border-wheat bg-wheat/20 px-4 py-3 text-sm font-medium text-ink", children: "Showing the fallback verse." })) : null, isLoading ? (_jsx("div", { className: "h-80 animate-pulse rounded-lg border border-line bg-white" })) : (_jsx(VerseCard, { verse: verse, markedRead: markedRead, onMarkRead: () => setMarkedRead(true) }))] }), _jsx("aside", { className: "space-y-3", children: _jsxs("section", { className: "rounded-lg border border-line bg-white p-4", children: [_jsxs("div", { className: "mb-4 flex items-center gap-2 text-sm font-semibold text-evergreen", children: [_jsx(CalendarDays, { "aria-hidden": "true", size: 18 }), verse.date] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { type: "button", className: "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-ink/70 transition hover:border-evergreen hover:text-evergreen", children: [_jsx(ChevronLeft, { "aria-hidden": "true", size: 18 }), "Yesterday"] }), _jsx("button", { type: "button", className: "inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-ink/70 transition hover:border-evergreen hover:text-evergreen", "aria-label": "Next verse", title: "Next verse", disabled: true, children: _jsx(ChevronRight, { "aria-hidden": "true", size: 18 }) })] })] }) })] }) }));
}
