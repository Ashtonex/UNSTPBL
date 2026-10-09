import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { can, type Capability } from '@unstpbl/shared';
import { useAuthStore } from '../stores/auth';

/**
 * Shows a page only to roles that may use it. The API enforces this too; this just keeps
 * someone who types a staff address from landing on a screen full of "forbidden" errors.
 */
export default function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const role = useAuthStore((state) => state.profile?.role);
  if (can(role, capability)) return <>{children}</>;

  return (
    <div className="w-full max-w-lg mx-auto py-10 text-center space-y-3 animate-fade-in">
      <h2 className="text-xl font-bold text-white">This page is for the church team</h2>
      <p className="text-white/45 text-sm">Your account does not have access to this. If you should, ask an admin to update your role.</p>
      <Link to="/" className="inline-block text-sm text-brand-300 hover:text-brand-200">
        Back to today&apos;s verse
      </Link>
    </div>
  );
}
