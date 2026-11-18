"use client";
export default function LanguageSwitcher({lang}:{lang:"ar"|"en"}){
 function change(){document.cookie="ln_lang="+(lang==="ar"?"en":"ar")+"; path=/; max-age=31536000; samesite=lax";window.location.reload();}
 return <button type="button" className="language-switch" onClick={change} aria-label={lang==="ar"?"Switch to English":"التبديل إلى العربية"}>{lang==="ar"?"EN":"العربية"}</button>;
}
