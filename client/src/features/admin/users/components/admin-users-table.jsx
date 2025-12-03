/**
 * @file client/src/features/admin/users/components/admin-users-table.jsx
 * @description Admin table for managing users.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, deactivateUser } from '../api';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import LoadingSpinner from '@/components/loading-spinner';
import { Search, Ban, CheckCircle, ShieldAlert, User } from 'lucide-react';

export default function AdminUsersTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Fetch users with search/pagination
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => getAdminUsers({ page, pageSize: 20, search }),
    keepPreviousData: true,
  });

  // Mutation to deactivate user
  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
    }
  });

  const handleSearch = (e) => {
    // Optional: debounce this in a real app
    setSearch(e.target.value);
    setPage(1); // Reset to page 1 on new search
  };

  if (isLoading && !data) return <LoadingSpinner centered />;

  const users = data?.users || [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search users by name, email or ID..." 
            value={search} 
            onChange={handleSearch}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium">
            <tr>
              <th className="h-10 px-4 align-middle">User</th>
              <th className="h-10 px-4 align-middle">Email / ID</th>
              <th className="h-10 px-4 align-middle">Role</th>
              <th className="h-10 px-4 align-middle">Status</th>
              <th className="h-10 px-4 align-middle text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/50 transition-colors">
                  <td className="p-4 align-middle font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                        {u.profileImageUrl ? (
                          <img src={u.profileImageUrl} className="h-full w-full object-cover" alt="avatar" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div>{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-muted-foreground">{u.country}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 align-middle">
                    <div className="font-medium">{u.email}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.userId}</div>
                  </td>
                  <td className="p-4 align-middle">
                    {u.role === 'ADMIN' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        <ShieldAlert className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Traveler
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    {u.isActive ? (
                      <span className="text-green-600 flex items-center gap-1 text-xs font-medium">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1 text-xs font-medium">
                        <Ban className="h-3 w-3" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-middle text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={!u.isActive || u.role === 'ADMIN'} 
                      onClick={() => {
                        if(confirm('Are you sure you want to deactivate this user?')) {
                          deactivateMutation.mutate(u.id);
                        }
                      }}
                      title="Suspend User"
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground text-center">
        Showing page {page}
      </div>
    </div>
  );
}