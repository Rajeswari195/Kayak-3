/**
 * @file client/src/app/admin/admin-billing-page.jsx
 * @description Admin page for billing reports.
 */

import React from 'react';
import BillingList from '@/features/admin/billing/components/billing-list';

export default function AdminBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & Revenue</h1>
        <p className="text-muted-foreground">View transaction history and monthly revenue.</p>
      </div>
      <BillingList />
    </div>
  );
}