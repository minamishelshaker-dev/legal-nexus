"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function SignOutButton() {
 const router=useRouter();
 return <button className="signout" onClick={async()=>{const supabase=createClient();await supabase.auth.signOut();router.replace("/login");router.refresh();}}>Sign out</button>;
}