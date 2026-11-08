import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DailyVerse } from '@unstpbl/shared';
import { api } from '../lib/api';
import { CLICKABLE_FOCUS, clickableProps } from '../lib/clickable';
import { useQueryKeys } from '../lib/queryKeys';
import { Notice, PageHeader } from '../components/ui';
import VerseCard from '../components/VerseCard';

export default function SearchPage() {
  const keys = useQueryKeys();
  const [queryText, setQueryText] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [activeVerse, setActiveVerse] = useState<DailyVerse | null>(null);

  // Fetch search results on demand
  const { data, isLoading, error } = useQuery({
    queryKey: keys.semanticSearch(queryText),
    queryFn: () => api.searchVerses(queryText),
    enabled: searchTriggered && queryText.trim().length > 0,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim().length > 0) {
      setSearchTriggered(true);
      setActiveVerse(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryText(e.target.value);
    setSearchTriggered(false); // Reset trigger when typing
  };

  return (
    <div className="py-4 animate-fade-in space-y-6">
      <PageHeader title="Spiritual Semantic Search" subtitle="Search scriptures using natural language. Try searching for feelings, topics, or life situations (e.g., &quot;finding peace in anxiety&quot;, &quot;gratitude&quot;, &quot;forgiveness&quot;)." />

      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="What is on your heart today?..."
            value={queryText}
            onChange={handleInputChange}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-brand-500 focus:outline-none transition-colors"
          />
          <svg className="w-5 h-5 text-fg-muted absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          type="submit"
          disabled={queryText.trim().length === 0}
          className="bg-brand-500 hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50 text-white font-semibold px-6 rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/20 text-sm"
        >
          Search
        </button>
      </form>

      {/* Results Section */}
      <div className="space-y-4">
        {isLoading && (
          <div className="py-12 flex flex-col items-center gap-3">
            <span className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
            <p className="text-fg-muted text-xs">Computing query embedding & querying vector database...</p>
          </div>
        )}

        {error && (
          <Notice tone="error">
            Failed to complete semantic search. {(error as Error).message}
          </Notice>
        )}

        {searchTriggered && !isLoading && data && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-fg-muted uppercase tracking-widest">Top Matching Scriptures</h3>
              <span className="text-xs text-brand-400 font-semibold uppercase">{data.matches.length} Results</span>
            </div>

            {data.matches.length === 0 ? (
              <p className="text-center py-12 text-fg-muted text-sm">No scriptures matched your query closely. Try different terms.</p>
            ) : (
              <div className="space-y-3">
                {data.matches.map((match) => {
                  const matchPercentage = Math.round(match.score * 100);
                  
                  return (
                    <div 
                      key={match.verse.id} 
                      {...clickableProps(() => setActiveVerse({
                        verse: match.verse,
                        book: match.book,
                        schedule: {
                          id: `search-${match.verse.id}`,
                          date: new Date().toISOString().split('T')[0],
                          verseId: match.verse.id,
                          mode: 'manual',
                        },
                      }))}
                      className={`glass-card p-5 cursor-pointer hover:bg-white/[0.04] transition-colors border border-white/5 relative overflow-hidden group ${CLICKABLE_FOCUS} ${
                        activeVerse?.verse?.id === match.verse.id ? 'border-brand-500/40 ring-1 ring-brand-500/20' : ''
                      }`}
                    >
                      {/* Match Score Badge */}
                      <div className="absolute top-0 right-0 px-3 py-1 bg-brand-500/10 rounded-bl-xl text-xs font-bold text-brand-400 border-l border-b border-brand-500/20">
                        {matchPercentage}% Match
                      </div>

                      <blockquote className="text-sm text-fg-soft pr-12 line-clamp-3 italic mb-3">
                        &ldquo;{match.verse.text}&rdquo;
                      </blockquote>

                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white group-hover:text-brand-400 transition-colors">
                          {match.book.name} {match.verse.chapter}:{match.verse.verseNumber}
                        </span>
                        <span className="text-fg-muted text-xs uppercase font-semibold">
                          {match.verse.translation}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Verse Detail Modal overlay */}
      {activeVerse && (
        <div className="glass-card p-6 border border-brand-500/30 animate-fade-in relative">
          <button 
            onClick={() => setActiveVerse(null)}
            className="absolute top-4 right-4 text-fg-muted hover:text-fg-soft"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="mb-4">
            <span className="text-xs text-brand-400 font-bold uppercase tracking-wider">Passage Details</span>
          </div>

          <VerseCard dailyVerse={activeVerse} isRead={true} />
        </div>
      )}
    </div>
  );
}
