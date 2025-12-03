/**
 * @file client/src/app/admin/admin-users-page.jsx
 * @description Admin page for managing users.
 */

import React from 'react';
import AdminUsersTable from '@/features/admin/users/components/admin-users-table';

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage customer accounts and permissions.</p>
      </div>
      <AdminUsersTable />
    </div>
  );
}