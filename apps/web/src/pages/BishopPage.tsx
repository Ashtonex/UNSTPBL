import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const LOCAL_BIBLE_BOOKS = [
  { id: 1, name: 'Genesis', abbreviation: 'GEN' },
  { id: 2, name: 'Exodus', abbreviation: 'EXO' },
  { id: 3, name: 'Leviticus', abbreviation: 'LEV' },
  { id: 4, name: 'Numbers', abbreviation: 'NUM' },
  { id: 5, name: 'Deuteronomy', abbreviation: 'DEU' },
  { id: 6, name: 'Joshua', abbreviation: 'JOS' },
  { id: 7, name: 'Judges', abbreviation: 'JDG' },
  { id: 8, name: 'Ruth', abbreviation: 'RUT' },
  { id: 9, name: '1 Samuel', abbreviation: '1SA' },
  { id: 10, name: '2 Samuel', abbreviation: '2SA' },
  { id: 11, name: '1 Kings', abbreviation: '1KI' },
  { id: 12, name: '2 Kings', abbreviation: '2KI' },
  { id: 13, name: '1 Chronicles', abbreviation: '1CH' },
  { id: 14, name: '2 Chronicles', abbreviation: '2CH' },
  { id: 15, name: 'Ezra', abbreviation: 'EZR' },
  { id: 16, name: 'Nehemiah', abbreviation: 'NEH' },
  { id: 17, name: 'Esther', abbreviation: 'EST' },
  { id: 18, name: 'Job', abbreviation: 'JOB' },
  { id: 19, name: 'Psalms', abbreviation: 'PSA' },
  { id: 20, name: 'Proverbs', abbreviation: 'PRO' },
  { id: 21, name: 'Ecclesiastes', abbreviation: 'ECC' },
  { id: 22, name: 'Song of Solomon', abbreviation: 'SNG' },
  { id: 23, name: 'Isaiah', abbreviation: 'ISA' },
  { id: 24, name: 'Jeremiah', abbreviation: 'JER' },
  { id: 25, name: 'Lamentations', abbreviation: 'LAM' },
  { id: 26, name: 'Ezekiel', abbreviation: 'EZK' },
  { id: 27, name: 'Daniel', abbreviation: 'DAN' },
  { id: 28, name: 'Hosea', abbreviation: 'HOS' },
  { id: 29, name: 'Joel', abbreviation: 'JOL' },
  { id: 30, name: 'Amos', abbreviation: 'AMO' },
  { id: 31, name: 'Obadiah', abbreviation: 'OBD' },
  { id: 32, name: 'Jonah', abbreviation: 'JON' },
  { id: 33, name: 'Micah', abbreviation: 'MIC' },
  { id: 34, name: 'Nahum', abbreviation: 'NAM' },
  { id: 35, name: 'Habakkuk', abbreviation: 'HAB' },
  { id: 36, name: 'Zephaniah', abbreviation: 'ZEP' },
  { id: 37, name: 'Haggai', abbreviation: 'HAG' },
  { id: 38, name: 'Zechariah', abbreviation: 'ZEC' },
  { id: 39, name: 'Malachi', abbreviation: 'MAL' },
  { id: 40, name: 'Matthew', abbreviation: 'MAT' },
  { id: 41, name: 'Mark', abbreviation: 'MRK' },
  { id: 42, name: 'Luke', abbreviation: 'LUK' },
  { id: 43, name: 'John', abbreviation: 'JHN' },
  { id: 44, name: 'Acts', abbreviation: 'ACT' },
  { id: 45, name: 'Romans', abbreviation: 'ROM' },
  { id: 46, name: '1 Corinthians', abbreviation: '1CO' },
  { id: 47, name: '2 Corinthians', abbreviation: '2CO' },
  { id: 48, name: 'Galatians', abbreviation: 'GAL' },
  { id: 49, name: 'Ephesians', abbreviation: 'EPH' },
  { id: 50, name: 'Philippians', abbreviation: 'PHP' },
  { id: 51, name: 'Colossians', abbreviation: 'COL' },
  { id: 52, name: '1 Thessalonians', abbreviation: '1TH' },
  { id: 53, name: '2 Thessalonians', abbreviation: '2TH' },
  { id: 54, name: '1 Timothy', abbreviation: '1TI' },
  { id: 55, name: '2 Timothy', abbreviation: '2TI' },
  { id: 56, name: 'Titus', abbreviation: 'TIT' },
  { id: 57, name: 'Philemon', abbreviation: 'PHM' },
  { id: 58, name: 'Hebrews', abbreviation: 'HEB' },
  { id: 59, name: 'James', abbreviation: 'JAS' },
  { id: 60, name: '1 Peter', abbreviation: '1PE' },
  { id: 61, name: '2 Peter', abbreviation: '2PE' },
  { id: 62, name: '1 John', abbreviation: '1JN' },
  { id: 63, name: '2 John', abbreviation: '2JN' },
  { id: 64, name: '3 John', abbreviation: '3JN' },
  { id: 65, name: 'Jude', abbreviation: 'JUD' },
  { id: 66, name: 'Revelation', abbreviation: 'REV' }
];

export default function BishopPage() {
  const queryClient = useQueryClient();
  const [bookId, setBookId] = useState<number | ''>('');
  const [chapter, setChapter] = useState<number | ''>('');
  const [verseNumber, setVerseNumber] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Admin Stats (Read rates and total members count)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.getAdminStats,
    refetchInterval: 15000,
  });

  // Fetch Trends and Translation Breakdown
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['admin-stats-trends'],
    queryFn: api.getAdminStatsTrends,
    refetchInterval: 60000,
  });

  const { data: translationsData, isLoading: translationsLoading } = useQuery({
    queryKey: ['admin-stats-translations'],
    queryFn: api.getAdminStatsTranslations,
    refetchInterval: 60000,
  });

  // 2. Fetch Bible Books for dropdown selection
  const { data: booksData } = useQuery({
    queryKey: ['admin-books'],
    queryFn: api.getAdminBooks,
  });

  const books = (booksData?.books && booksData.books.length > 0) ? booksData.books : LOCAL_BIBLE_BOOKS;


  // 3. Mutation for scheduling a verse
  const scheduleMutation = useMutation({
    mutationFn: api.scheduleVerse,
    onSuccess: () => {
      setSuccessMsg('Verse successfully scheduled!');
      setErrorMsg(null);
      setBookId('');
      setChapter('');
      setVerseNumber('');
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['verse-today'] });
      queryClient.invalidateQueries({ queryKey: ['verse-history'] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to schedule verse. Please check inputs and try again.');
      setSuccessMsg(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookId || !chapter || !verseNumber || !date) {
      setErrorMsg('Please fill in all scheduling fields.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    scheduleMutation.mutate({
      date,
      bookId: Number(bookId),
      chapter: Number(chapter),
      verseNumber: Number(verseNumber),
    });
  };

  return (
    <div className="py-4 animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Bishop Dashboard</h2>
        <p className="text-white/40 text-sm">Manage daily scripture reading schedules and track congregation completion trends.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 animate-slide-up relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 bg-brand-500/10 rounded-bl-2xl">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Total Members</p>
          <p className="text-4xl font-bold text-gradient mt-2">
            {statsLoading ? (
              <span className="inline-block w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
            ) : (
              stats?.memberCount ?? 0
            )}
          </p>
        </div>

        <div
          className="glass-card p-5 animate-slide-up relative overflow-hidden"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="absolute top-0 right-0 p-3 bg-brand-500/10 rounded-bl-2xl">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Today&apos;s Read Rate</p>
          <p className="text-4xl font-bold text-gradient mt-2">
            {statsLoading ? (
              <span className="inline-block w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
            ) : (
              `${stats?.readRate ?? 0}%`
            )}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Area Chart: Engagement Trends */}
        <div className="glass-card p-5 animate-slide-up flex flex-col h-[320px]">
          <h3 className="text-sm font-bold text-white mb-2">Congregation Engagement (30d)</h3>
          <div className="flex-1 min-h-0">
            {trendsLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsData?.trends || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(tick) => tick.split('-')[2]} stroke="rgba(255,255,255,0.3)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b0f13', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="reads" name="Reads" stroke="#eab308" fillOpacity={1} fill="url(#colorReads)" strokeWidth={2} />
                  <Area type="monotone" dataKey="signups" name="Signups" stroke="#06b6d4" fillOpacity={1} fill="url(#colorSignups)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart: Translation breakdown */}
        <div className="glass-card p-5 animate-slide-up flex flex-col h-[320px]">
          <h3 className="text-sm font-bold text-white mb-2">Translation Preferences</h3>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {translationsLoading ? (
              <span className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={translationsData?.translations || []}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(translationsData?.translations || []).map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#eab308' : '#06b6d4'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b0f13', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Form */}
      <div
        className="glass-card p-6 animate-slide-up"
        style={{ animationDelay: '0.2s' }}
      >
        <h3 className="text-lg font-bold text-white mb-4">Schedule Daily Scripture</h3>
        
        {successMsg && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Book Selection */}
            <div>
              <label htmlFor="book-select" className="block text-white/50 text-xs font-semibold mb-2">BIBLE BOOK</label>
              <select
                id="book-select"
                value={bookId}
                onChange={(e) => setBookId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="" className="bg-neutral-900 text-white/50">Select a book...</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id} className="bg-neutral-900 text-white">
                    {book.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label htmlFor="schedule-date" className="block text-white/50 text-xs font-semibold mb-2">PUBLISH DATE</label>
              <input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Chapter */}
            <div>
              <label htmlFor="chapter-input" className="block text-white/50 text-xs font-semibold mb-2">CHAPTER</label>
              <input
                id="chapter-input"
                type="number"
                min="1"
                placeholder="e.g. 3"
                value={chapter}
                onChange={(e) => setChapter(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Verse */}
            <div>
              <label htmlFor="verse-input" className="block text-white/50 text-xs font-semibold mb-2">VERSE NUMBER</label>
              <input
                id="verse-input"
                type="number"
                min="1"
                placeholder="e.g. 16"
                value={verseNumber}
                onChange={(e) => setVerseNumber(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={scheduleMutation.isPending}
            className="w-full mt-4 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/20 flex justify-center items-center gap-2"
          >
            {scheduleMutation.isPending ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scheduling & Fetching Verse...
              </>
            ) : (
              'Schedule Verse'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
