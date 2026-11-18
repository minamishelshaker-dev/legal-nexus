import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
 const url=new URL(request.url);
 const code=url.searchParams.get("code");
 if(!code) return NextResponse.redirect(new URL("/login?error=confirmation",url.origin));
 const supabase=await createClient();
 const {error}=await supabase.auth.exchangeCodeForSession(code);
 if(error) return NextResponse.redirect(new URL("/login?error=confirmation",url.origin));
 const {data:{user}}=await supabase.auth.getUser();
 if(user) {
  await supabase.from("user_profiles").upsert({
   id:user.id,
   full_name:typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name:null
  });
 }
 return NextResponse.redirect(new URL("/workspace",url.origin));
}