"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ErrorState, LoadingState, MetricCard, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { friendlyErrorMessage } from "../../../lib/error-message";
import { WalletReservation } from "../../../lib/types";

function centsToMajor(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function WalletReservationDetailPage({ params }: { params: { id: string } }) {
  const [reservation, setReservation] = useState<WalletReservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.get<WalletReservation>(`/api/admin/wallet-reservations/${params.id}`);
      setReservation(result);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading && !reservation) {
    return <LoadingState />;
  }

  if (error || !reservation) {
    return <ErrorState message={error ?? "Unable to load reservation."} action={<Button onClick={() => load()}>Retry</Button>} />;
  }

  return (
    <div>
      <PageHeader
        title={`Reservation — ${reservation.cartKey}`}
        description="A wallet reservation only ever results in a wallet ledger debit once it reaches 'confirmed' — releases and expirations never touch the ledger."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", maxWidth: 720, marginBottom: "1.5rem" }}>
        <MetricCard label="Amount" value={`$${centsToMajor(reservation.amountCents)} ${reservation.currency}`} />
        <MetricCard label="Status" value={<StatusBadge status={reservation.status === "active" || reservation.status === "confirmed" ? "active" : "failed"} />} />
        <MetricCard label="WooCommerce Order" value={reservation.woocommerceOrderId ?? "—"} />
      </div>

      <p>
        <strong>Expires at:</strong> {new Date(reservation.expiresAt).toLocaleString()}
      </p>
      <p>
        <strong>Created at:</strong> {new Date(reservation.createdAt).toLocaleString()}
      </p>
    </div>
  );
}
