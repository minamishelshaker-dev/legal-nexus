"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Mode = "login" | "signup";
export default function AuthForm({ mode }: { mode: Mode }) {
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [fullName,setFullName]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const router=useRouter();
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault(); setBusy(true); setError(""); setMessage("");
  const supabase=createClient();
  try {
   if(mode==="login") {
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    const nextPath=new URLSearchParams(window.location.search).get("next");
    router.replace(nextPath?.startsWith("/") ? nextPath : "/workspace"); router.refresh();
   } else {
    const {data,error}=await supabase.auth.signUp({
     email,password,
     options:{emailRedirectTo:`${window.location.origin}/auth/callback`,data:{full_name:fullName}}
    });
    if(error) throw error;
    if(data.session && data.user) {
     await supabase.from("user_profiles").upsert({id:data.user.id,full_name:fullName || null});
     router.replace("/workspace"); router.refresh();
    } else {
     setMessage("Your account has been created. Please check your email to¶»§q«^