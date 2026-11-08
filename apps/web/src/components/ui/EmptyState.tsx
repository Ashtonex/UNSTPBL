import type { ReactNode } from 'react';
import { useOnline } from '../../hooks/useOnline';
import { SkeletonList } from './Skeleton';

/** A centred message for "nothing here yet", "something went wrong" or "you're offline". */
export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass-card p-8 text-center flex flex-col items-center gap-2">
      {icon && (
        <div aria-hidden="true" className="text-3xl mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-fg">{title}</h3>
      {description && <p className="text-sm text-fg-muted max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * What to show while a page's data is on its way.
 * Online: skeleton cards. Offline with nothing saved: an honest message, instead of a loading
 * indicator that would never finish.
 */
export function PendingState({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  const online = useOnline();
  if (!online) {
    return (
      <EmptyState
        icon="📡"
        title="You're offline"
        description="This will load as soon as you're back online."
      />
    );
  }
  return <SkeletonList count={count} label={label} />;
}
