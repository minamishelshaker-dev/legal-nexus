"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function OnboardingForm() {
 const [name,setName]=useState("");
 const [slug,setSlug]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const router=useRouter();
 function updateName(value:string) {
  setName(value);
  if(!slug) setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""));
 }
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault(); setBusy(true); setError("");
  try {
   const supabase=createClient();
   const {data:{user},error:userError}=await supabase.auth.getUser();
   if(userError || !user) throw new Error("Your session has expired. Please sign in again.");
   const normalizedSlug=slug.toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"") || `organization-${crypto.randomUUID().slice(0,8)}`;
   const {error:insertError}=await supabase.from("organizations").insert({name:name.trim(),slug:normalizedSlug,created_by:user.id});
   if(insertError) throw insertError;
   router.replace("/workspace"); router.refresh();
  } catch(err) {
   setError(err instanceof Error?err.message:"Unable to create the organization. Please try again.");
  } finally { setBusy(false); }
 }
 return <form className="auth-form onboard-form" onSubmit={submit}>
  <label>Organization name<input required min¶»§q«^