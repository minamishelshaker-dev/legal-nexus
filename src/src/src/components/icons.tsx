const PATHS: Record<string, string[]> = {
  home: ["M4 10.5 12 4l8 6.5V20H4z", "M10 20v-6h4v6"],
  inbox: ["M4 13l2-8h12l2 8", "M4 13v6h16v-6", "M4 13h5a3 3 0 0 0 6 0h5"],
  contract: ["M7 3h7l5 5v13H7z", "M14 3v5h5", "M10 13h6", "M10 17h6"],
  scale: ["M12 4v16", "M7 20h10", "M5 7h14", "M5 7l-3 7a3.5 3 0 0 0 6 0z", "M19 7l-3 7a3.5 3 0 0 0 6 0z"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  folder: ["M3 6h6l2 2h10v11H3z"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  building: ["M4 21V5l8-2v18", "M12 9h8v12", "M7 8h2", "M7 12h2", "M7 16h2", "M15 13h2", "M15 17h2"],
  users: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5", "M16 4.5a3 3 0 0 1 0 6", "M18 14.8c2 .6 3.3 2.3 3.6 5.2"],
  badge: ["M4 6h16v13H4z", "M9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M6 17c.4-1.8 1.6-2.6 3-2.6s2.6.8 3 2.6", "M14 10h4", "M14 14h4"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  alert: ["M12 4l9 16H3z", "M12 10v4", "M12 17.5v.01"],
  plus: ["M12 5v14", "M5 12h14"],
  upload: ["M12 16V5", "M7.5 9.5 12 5l4.5 4.5", "M5 19h14"],
  download: ["M12 4v11", "M7.5 11.5 12 16l4.5-4.5", "M5 19h14"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4-4"],
  chat: ["M4 5h16v11H10l-4 4v-4H4z", "M8 9h8", "M8 12.5h5"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  send: ["M4 12 20 4l-5 16-3-7z", "M12 13l8-9"],
  trash: ["M5 7h14", "M10 7V4h4v3", "M7 7l1 13h8l1-13"],
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={name === "arrow" ? "flip" : undefined}
    >
      {(PATHS[name] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="lnGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6cd96" />
          <stop offset="1" stopColor="#a8854a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#lnGold)" />
      <path d="M12 28V12l16 16V12" fill="none" stroke="#0b1220" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.7" fill="#0b1220" />
      <circle cx="28" cy="28" r="2.7" fill="#0b1220" />
    </svg>
  );
}
