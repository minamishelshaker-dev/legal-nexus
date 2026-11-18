import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const allowedOtpTypes: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let verificationError: Error | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verificationError = error;
  } else if (tokenHash && otpType && allowedOtpTypes.includes(otpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    verificationError = error;
  } else {
    verificationError = new Error("Missing or invalid authentication callback parameters");
  }

  if (verificationError) {
    const destination = new URL("/login", url.origin);
    destination.searchParams.set("error", "confirmation");
    return NextResponse.redirect(destination);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    const destination = new URL("/login", url.origin);
    destination.searchParams.set("error", "session");
    return NextResponse.redirect(destination);
  }

  const requestedNext = url.searchParams.get("next");;
  const safeNext = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") 
    ? new URL(requestedNext, url.origin).origin === url.origin ? requestedNext : null
    : null;\n  const recoveryRequested = otpType === "recovery" || safeNext === "/reset-password";

  // Password recovery only needs a valid recovery session. Do not let an unrelated
  // profile-upsert issue prevent the user from setting a new password.
  if (!recoveryRequested) {
    const fullName = typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : null;

    const { error: profileError } = await supabase.from("user_profiles").upsert({
      id: user.id,
      full_name: fullName || null,
    });

    if (profileError) {
      const destination = new URL("/login", url.origin);
      destination.searchParams.set("error", "profile");
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(new URL(recoveryRequested ? "/reset-password" : safeNext || "/workspace", url.origin));
}
