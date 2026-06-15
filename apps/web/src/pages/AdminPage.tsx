export default function AdminPage() {
  return (
    <div className="py-4 animate-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1">Bishop Dashboard</h2>
        <p className="text-white/40 text-sm">Manage verse schedules and congregation.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-card p-4 animate-slide-up">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Members</p>
          <p className="text-3xl font-bold text-gradient mt-1">--</p>
        </div>
        <div
          className="glass-card p-4 animate-slide-up"
          style={{ animationDelay: '0.1s' }}
        >
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Read Rate</p>
          <p className="text-3xl font-bold text-gradient mt-1">--%</p>
        </div>
      </div>

      {/* Today's Schedule */}
      <div
        className="glass-card p-5 mb-4 animate-slide-up"
        style={{ animationDelay: '0.2s' }}
      >
        <h3 className="text-white/70 font-semibold text-sm mb-3">Today&apos;s Scheduled Verse</h3>
        <p className="text-white/30 text-sm italic">
          No verse scheduled yet. Scheduling controls coming in Phase 3.
        </p>
      </div>

      {/* Coming Soon */}
      <div
        className="glass-card p-5 animate-slide-up"
        style={{ animationDelay: '0.3s' }}
      >
        <h3 className="text-white/70 font-semibold text-sm mb-3">Coming Soon</h3>
        <ul className="space-y-2 text-white/30 text-sm">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500/50" />
            Manual verse scheduling
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500/50" />
            Sequential book/chapter scheduling
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500/50" />
            Push notification controls
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500/50" />
            Member export (CSV)
          </li>
        </ul>
      </div>
    </div>
  );
}
