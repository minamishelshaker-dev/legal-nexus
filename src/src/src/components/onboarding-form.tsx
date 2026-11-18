"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your session has expired. Please sign in again.");

      const { error: insertError } = await supabase
        .from("organizations")
        .insert({ name: name.trim(), created_by: user.id });
      if (insertError) throw insertError;

      router.replace("/workspace");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the organization. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Organization name
        <input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your company or institution" />
      </label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>
        {busy ? "Creating workspace..." : "Create organization"}
      </button>
    </form>
  );
}
