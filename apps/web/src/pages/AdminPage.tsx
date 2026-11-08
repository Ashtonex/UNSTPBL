import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS, USER_ROLES, isUserRole, type UserRole } from '@unstpbl/shared';
import { api } from '../lib/api';
import { useQueryKeys } from '../lib/queryKeys';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const keys = useQueryKeys();
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Users List
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: keys.adminUsers(),
    queryFn: api.getAdminUsersList,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: keys.adminAudit(),
    queryFn: () => api.getAdminAuditLogs(10),
  });

  // 3. Mutation for updating user role
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.updateUserRole(userId, role),
    onSuccess: (_data, variables) => {
      setSuccessMsg(`Successfully updated user to role: ${variables.role}`);
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: keys.adminUsers() });
      queryClient.invalidateQueries({ queryKey: keys.adminAudit() });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Failed to update user role.');
      setSuccessMsg(null);
    },
  });

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  // Filter users based on query
  const filteredUsers = (usersData?.users || []).filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.displayName && user.displayName.toLowerCase().includes(query)) ||
      (user.congregation && user.congregation.toLowerCase().includes(query))
    );
  });

  return (
    <div className="py-4 animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">System Administration</h2>
        <p className="text-white/40 text-sm">Manage user roles, platform permissions, and monitor system metrics.</p>
      </div>

      {usersError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl">
          Could not load users. {(usersError as Error).message}
        </div>
      )}

      {/* Stats Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-5 animate-slide-up relative overflow-hidden">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Total Registered Users</p>
          <p className="text-4xl font-bold text-gradient mt-2">
            {usersLoading ? (
              <span className="inline-block w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
            ) : (
              usersData?.users?.length ?? 0
            )}
          </p>
        </div>

        <div className="glass-card p-5 animate-slide-up relative overflow-hidden" style={{ animationDelay: '0.1s' }}>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Sentry Error Monitoring</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-white">Active & Connected</span>
          </div>
          <p className="text-xs text-white/30 mt-1">DSN: ingest.de.sentry.io</p>
        </div>
      </div>

      <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Recent Admin Activity</h3>
          <span className="text-xs text-white/30 uppercase font-bold tracking-widest">Audit Log</span>
        </div>

        {auditLoading ? (
          <div className="py-8 flex justify-center items-center">
            <span className="w-7 h-7 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : auditData?.logs && auditData.logs.length > 0 ? (
          <div className="divide-y divide-white/5">
            {auditData.logs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <p className="text-sm font-semibold text-white">{log.action.replaceAll('.', ' ')}</p>
                  <p className="text-xs text-white/40">
                    {log.actorDisplayName || log.actorEmail} · {log.targetType}
                    {log.targetId ? `:${log.targetId}` : ''}
                  </p>
                </div>
                <time className="text-xs text-white/30 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-white/30 text-sm">No admin activity has been recorded yet.</p>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* User Directory Table Card */}
      <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-white">User Directory</h3>
          
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search email, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:border-brand-500 focus:outline-none transition-colors w-full sm:w-64"
            />
            <svg className="w-4 h-4 text-white/30 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {usersLoading ? (
          <div className="py-12 flex justify-center items-center">
            <span className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center py-8 text-white/30 text-sm">No users found matching query.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {filteredUsers.map((user) => (
              <li key={user.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm break-words">
                    {user.displayName || 'Unnamed Member'}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5 break-all">{user.email}</div>
                  {user.congregation && (
                    <div className="text-xs text-brand-400 font-medium uppercase mt-1 break-words">
                      {user.congregation}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                    user.role === 'admin'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : user.role === 'bishop'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : isUserRole(user.role) && user.role !== 'member'
                          ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                          : 'bg-white/5 text-white/60'
                  }`}>
                    {isUserRole(user.role) ? ROLE_LABELS[user.role] : user.role}
                  </span>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                    disabled={updateRoleMutation.isPending}
                    aria-label={`Change role for ${user.displayName || user.email}`}
                    className="flex-1 sm:flex-none min-w-[11rem] bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 min-h-[40px] text-white text-xs focus:border-brand-500 focus:outline-none transition-colors cursor-pointer"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        Make {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
