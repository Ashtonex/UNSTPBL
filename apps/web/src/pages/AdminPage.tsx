import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Users List
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.getAdminUsersList,
  });

  // 2. Fetch general stats for summary card
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.getAdminStats,
  });

  // 3. Mutation for updating user role
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'member' | 'bishop' | 'admin' }) =>
      api.updateUserRole(userId, role),
    onSuccess: (data: any, variables) => {
      setSuccessMsg(`Successfully updated user to role: ${variables.role}`);
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update user role.');
      setSuccessMsg(null);
    },
  });

  const handleRoleChange = (userId: string, newRole: 'member' | 'bishop' | 'admin') => {
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 pb-2">
                  <th className="pb-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Member</th>
                  <th className="pb-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Role</th>
                  <th className="pb-3 text-xs font-semibold text-white/40 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4">
                      <div className="font-semibold text-white text-sm">
                        {user.displayName || 'Unnamed Member'}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">{user.email}</div>
                      {user.congregation && (
                        <div className="text-[10px] text-brand-400 font-medium uppercase mt-1">
                          {user.congregation}
                        </div>
                      )}
                    </td>
                    <td className="py-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                        user.role === 'admin' 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : user.role === 'bishop' 
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                            : 'bg-white/5 text-white/60'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                        disabled={updateRoleMutation.isPending}
                        className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:border-brand-500 focus:outline-none transition-colors cursor-pointer"
                      >
                        <option value="member">Make Member</option>
                        <option value="bishop">Make Bishop</option>
                        <option value="admin">Make Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
