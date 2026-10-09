import { Link } from 'react-router-dom';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, can, isUserRole, type Capability } from '@unstpbl/shared';
import { useAuthStore } from '../stores/auth';
import RequireCapability from '../components/RequireCapability';

interface Tool {
  to: string;
  title: string;
  detail: string;
  needs: Capability;
}

// Each person sees only the tools their role allows.
const TOOLS: Tool[] = [
  { to: '/visitors', title: 'Guests', detail: 'Register a guest, record a return visit, and follow up.', needs: 'visitors.view' },
  { to: '/messages', title: 'Text messages', detail: 'Send an announcement and see what has gone out.', needs: 'messages.send' },
  { to: '/messages/wording', title: 'Message wording', detail: 'Edit the thank-you, birthday and daily verse texts.', needs: 'messages.wording' },
];

function TeamHub() {
  const role = useAuthStore((state) => state.profile?.role);
  const tools = TOOLS.filter((tool) => can(role, tool.needs));

  return (
    <div className="w-full max-w-lg mx-auto py-4 animate-fade-in space-y-5">
      <section>
        <h2 className="text-2xl font-bold text-white mb-1">Church team</h2>
        {isUserRole(role) && (
          <p className="text-white/45 text-sm">
            You are signed in as <strong className="text-white/75">{ROLE_LABELS[role]}</strong>. {ROLE_DESCRIPTIONS[role]}
          </p>
        )}
      </section>

      {can(role, 'visitors.register') && (
        <Link
          to="/visitors"
          className="block rounded-2xl bg-brand-500 hover:bg-brand-600 transition-colors p-5 text-white shadow-lg shadow-brand-500/20"
        >
          <p className="text-lg font-bold">Register a guest</p>
          <p className="text-white/85 text-sm mt-0.5">Name, phone number and a tick to say they agree to be texted.</p>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className="glass-card p-4 block hover:bg-white/5 transition-colors">
            <p className="text-white font-semibold text-sm">{tool.title}</p>
            <p className="text-white/40 text-xs mt-1">{tool.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <RequireCapability capability="staff.hub">
      <TeamHub />
    </RequireCapability>
  );
}
