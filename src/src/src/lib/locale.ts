import { cookies } from "next/headers";
export async function getLocale():Promise<"ar"|"en">{const jar=await cookies();return jar.get("ln_lang")?.value==="ar"?"ar":"en";}
