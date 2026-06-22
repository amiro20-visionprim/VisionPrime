"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, ErrorState, LoadingState, PageHeader, StatusBadge } from "@visionprime/ui";
import { apiClient } from "../../../lib/api-client";
import { friendlyErrorMessage } from "../../../lib/error-message";
import { Product } from "../../../lib/types";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.get<Product>(`/api/admin/products/${params.id}`);
      setProduct(result);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !product) {
    return <ErrorState message={error ?? "Unable to load product."} action={<Button onClick={load}>Retry</Button>} />;
  }

  return (
    <div>
      <PageHeader
        title={product.name}
        description="Product detail. WooCommerce is the source of truth for this record."
        actions={
          <Button variant="secondary" onClick={() => router.push("/products")}>
            Back to Products
          </Button>
        }
      />

      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Status:</span>
          <StatusBadge status={product.status} />
        </div>
        <p>
          <strong>SKU:</strong> {product.sku ?? "—"}
        </p>
        <p>
          <strong>Price:</strong> {product.price ?? "—"}
        </p>
        <p>
          <strong>WooCommerce product ID:</strong> {product.woocommerce_product_id}
        </p>
        {product.category_woocommerce_ids.length > 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ marginBottom: "0.5rem" }}>
              <strong>Categories (WooCommerce IDs):</strong>
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {product.category_woocommerce_ids.map((id) => (
                <Badge key={id}>{id}</Badge>
              ))}
            </div>
          </div>
        ) : null}
        <p style={{ marginTop: "1rem" }}>
          <strong>Created:</strong> {new Date(product.created_at).toLocaleString()}
        </p>
        <p>
          <strong>Updated:</strong> {new Date(product.updated_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
