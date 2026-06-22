"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input } from "@visionprime/ui";
import { useAuth } from "../lib/auth-client";
import { friendlyErrorMessage } from "../lib/error-message";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Password is required.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (error) {
      setFormError(friendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: 320, display: "flex", flexDirection: "column" }}
        noValidate
      >
        <h1 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>VisionPrime OS</h1>

        {formError ? (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              borderRadius: 6,
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: "0.875rem",
            }}
          >
            {formError}
          </div>
        ) : null}

        <FormField label="Email" htmlFor="login-email" error={fieldErrors.email} required>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            hasError={Boolean(fieldErrors.email)}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Password" htmlFor="login-password" error={fieldErrors.password} required>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            hasError={Boolean(fieldErrors.password)}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <Button type="submit" isLoading={isSubmitting} style={{ marginTop: "0.5rem" }}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
