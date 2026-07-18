import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

function nameFor(user: { displayName?: string | null; id?: string }) {
  return user.displayName?.trim() || 'Church family member';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
}

function formatBirthday(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
}

export default function BirthdaysPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['birthdays'],
    queryFn: api.getBirthdays,
    refetchInterval: 60_000,
  });

  const dispatchMutation = useMutation({
    mutationFn: api.dispatchTodaysBirthdays,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthdays'] });
    },
  });

  return (
    <div className="w-full max-w-lg mx-auto py-4 animate-fade-in space-y-5">
      <section>
        <h2 className="text-3xl font-extrabold tracking-tight mb-2">
          <span className="text-gradient">Birthday Wall</span>
        </h2>
        <p className="text-white/45 text-sm">
          Celebrate members automatically from the birthdays saved on their profiles.
        </p>
      </section>

      <section className="glass-card p-5 border border-brand-500/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Today&apos;s automation</h3>
            <p className="text-xs text-white/45 mt-1">Creates wall posts and pushes birthday alerts to other subscribers.</p>
          </div>
          <button
            type="button"
            onClick={() => dispatchMutation.mutate()}
            disabled={dispatchMutation.isPending}
            className="shrink-0 px-4 py-2.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors"
          >
            {dispatchMutation.isPending ? 'Checking...' : 'Run Now'}
          </button>
        </div>
        {dispatchMutation.data && (
          <p className="text-xs text-emerald-300 mt-3">
            Created {dispatchMutation.data.created} post(s), sent {dispatchMutation.data.sent} notification(s).
          </p>
        )}
        {dispatchMutation.error && (
          <p className="text-xs text-rose-300 mt-3">Birthday dispatch failed. Please try again.</p>
        )}
      </section>

      {isLoading && (
        <div className="flex flex-col items-center py-12">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-white/40 text-xs">Loading birthday wall...</p>
        </div>
      )}

      {error && (
        <div className="glass-card p-5 border border-rose-500/20 text-rose-300 text-sm">
          Failed to load birthday wall.
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Wall Posts</h3>
            {data?.wall.length ? (
              data.wall.map((post) => {
                const name = nameFor(post.user);
                return (
                  <article key={post.id} className="glass-card p-5 border border-white/10">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-400/20 overflow-hidden flex items-center justify-center shrink-0">
                        {post.user.avatarUrl ? (
                          <img src={post.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-black text-brand-200">{initials(name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-bold text-white truncate">{name}</h4>
                            <p className="text-xs text-white/35 truncate">{post.user.congregation || 'UNSTPBL family'}</p>
                          </div>
                          <span className="text-[11px] text-brand-200 bg-brand-500/10 border border-brand-500/20 rounded-full px-2 py-1 whitespace-nowrap">
                            {formatBirthday(post.birthdayDate)}
                          </span>
                        </div>
                        <p className="text-sm text-white/75 leading-relaxed mt-3">{post.message}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="glass-card p-6 border border-white/10 text-center">
                <p className="text-sm font-semibold text-white">No birthday posts yet.</p>
                <p className="text-xs text-white/40 mt-1">Posts appear automatically on each visible member birthday.</p>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Upcoming</h3>
            {data?.upcoming.length ? (
              data.upcoming.map((person) => {
                const name = nameFor(person);
                return (
                  <div key={`${person.userId}-${person.birthday}`} className="glass-card p-4 border border-white/10 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-white/80">{initials(name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{name}</p>
                      <p className="text-xs text-white/40 truncate">{person.congregation || 'UNSTPBL family'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-brand-200">{person.daysUntil === 0 ? 'Today' : `${person.daysUntil}d`}</p>
                      <p className="text-[11px] text-white/35">{formatBirthday(person.birthday)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="glass-card p-5 border border-white/10 text-center text-sm text-white/45">
                No visible birthdays in the next 45 days.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
