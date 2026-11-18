"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode="login"|"signup";
export default function AuthForm({mode,lang="en",returnTo}:{mode:Mode;lang?:"ar"|"en";returnTo?:string}){
 const ar=lang==="ar";const safeReturnTo=returnTo&&returnTo.startsWith("/")&&!returnTo.startsWith("//")&&!returnTo.includes("\\")?returnTo:null;
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [fullName,setFullName]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");const router=useRouter();
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");setMessage("");const supabase=createClient();try{
  if(mode==="login"){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;router.replace(safeReturnTo||"/workspace");router.refresh();return;}
  const appOrigin = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? window.location.origin : "https://legal-nexus-hayah7.vercel.app";
  const callbackUrl=new URL("/auth/callback",appOrigin);if(safeReturnTo)callbackUrl.searchParams.set("next",safeReturnTo);const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:callbackUrl.toString(),data:{full_name:fullName.trim()||null}}});if(error)throw error;
  if(data.session){router.replace(safeReturnTo||"/onboarding");router.refresh();}else setMessage(ar?"تم استلام طلب إنشاء الحساب. تحقق من بريدك الإلكتروني واتبع رابط التأكيد للمتابعة.":"Your account request was received. Check your email and follow the confirmation link to continue.");
 }catch(e){setError(e instanceof Error?e.message:(ar?"حدث خطأ. حاول مرة أخرى.":"Something went wrong. Please try again."));}finally{setBusy(false);}}
 return <form className="auth-form" onSubmit={submit}>
  {mode==="signup"&&<label>{ar?"الاسم بالكامل":"Full name"}<input value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name"/></label>}
  <label>{ar?"البريد الإلكتروني":"Email address"}<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
  <label>{ar?"كلمة المرور":"Password"}<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"}/></label>
  {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-success" role="status">{message}</p>}
  <button className="auth-submit" type="submit" disabled={busy}>{busy?(ar?"يرجى الانتظار...":"Please wait..."):mode==="login"?(ar?"تسجيل الدخول بأمان":"Sign in securely"):(ar?"إنشاء الحساب":"Create account")}</button>
 </form>;
}
