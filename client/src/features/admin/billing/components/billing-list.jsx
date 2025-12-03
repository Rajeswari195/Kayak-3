/**
 * @file client/src/features/admin/billing/components/billing-list.jsx
 * @description Admin billing transaction report.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBillingReports } from '../api';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import LoadingSpinner from '@/components/loading-spinner';
import { Download, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BillingList() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-billing', month],
    queryFn: () => getBillingReports({ month }),
  });

  const transactions = data?.results || [];

  const totalRevenue = transactions.reduce((sum, t) => {
    return t.status === 'SUCCESS' ? sum + t.amount : sum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-end">
        <div className="flex gap-4 items-end">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Select Month</label>
            <Input 
              type="month" 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <Calendar className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="text-sm text-muted-foreground">Total Revenue ({month})</div>
          <div className="text-2xl font-bold text-primary flex items-center">
            <DollarSign className="h-5 w-5" />
            {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium">
            <tr>
              <th className="h-10 px-4 align-middle">Date</th>
              <th className="h-10 px-4 align-middle">Booking Ref</th>
              <th className="h-10 px-4 align-middle">User ID</th>
              <th className="h-10 px-4 align-middle">Method</th>
              <th className="h-10 px-4 align-middle">Status</th>
              <th className="h-10 px-4 align-middle text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                   <LoadingSpinner centered />
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No transactions found for this period.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-t hover:bg-muted/50 transition-colors">
                  <td className="p-4 align-middle whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString()}
                    <div className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-4 align-middle font-mono text-xs">
                    {tx.bookingId.slice(0,8)}...
                  </td>
                  <td className="p-4 align-middle font-mono text-xs text-muted-foreground">
                    {tx.userId.slice(0,8)}...
                  </td>
                  <td className="p-4 align-middle">
                    {tx.paymentMethod}
                    {tx.paymentToken && <span className="text-xs ml-1 text-muted-foreground">(***{tx.paymentToken.slice(-4)})</span>}
                  </td>
                  <td className="p-4 align-middle">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      tx.status === 'SUCCESS' ? "bg-green-100 text-green-700" :
                      tx.status === 'FAILED' ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    )}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-right font-medium">
                    {tx.currency} {tx.amount.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}