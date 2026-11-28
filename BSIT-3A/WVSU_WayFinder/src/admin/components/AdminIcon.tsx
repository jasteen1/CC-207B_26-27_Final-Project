import type { ReactNode } from "react";

export type AdminIconName =
  | "overview" | "directory" | "building" | "rooms" | "office"
  | "college" | "faculty" | "landmark" | "map" | "settings" | "search"
  | "plus" | "edit" | "close" | "download" | "check"
  | "alert" | "clock" | "chevron" | "external" | "route" | "refresh";

const shapes: Record<AdminIconName, ReactNode> = {
  overview: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5M9 21v-7h6v7" /></>,
  directory: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="2.5" cy="6" r=".5" /><circle cx="2.5" cy="12" r=".5" /><circle cx="2.5" cy="18" r=".5" /></>,
  building: <><path d="M4 21V5l8-2 8 2v16" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10 21v-4h4v4" /></>,
  rooms: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 3v18M3 12h18" /></>,
  office: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" /></>,
  college: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3 3 9 3 12 0v-5M22 9v7" /></>,
  faculty: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.4-3.3 2.4-5 6-5s5.6 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.5M18 15c1.7.6 2.7 2 3 5" /></>,
  landmark: <><path d="M5 21V3M5 4h14l-4 5 4 5H5" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2 2.1-2 2-2.1-1.2-.1-.1a8 8 0 0 1-2 .8l-.1.1-.5 2.3h-2.8l-.5-2.3-.1-.1a8 8 0 0 1-2-.8l-.1.1-2.1 1.2-2-2 1.2-2.1.1-.1a8 8 0 0 1-.8-2l-.1-.1L2.5 12v-2.8l2.3-.5.1-.1a8 8 0 0 1 .8-2l-.1-.1L4.4 4.4l2-2 2.1 1.2.1.1a8 8 0 0 1 2-.8l.1-.1.5-2.3H14l.5 2.3.1.1a8 8 0 0 1 2 .8l.1-.1 2.1-1.2 2 2-1.2 2.1-.1.1a8 8 0 0 1 .8 2l.1.1 2.3.5V12l-2.3.5-.1.1a8 8 0 0 1-.8 2Z" transform="translate(0 1) scale(.92)" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  edit: <><path d="m4 16.5-.8 4.3 4.3-.8L20 7.5 16.5 4 4 16.5Z" /><path d="m14.8 5.7 3.5 3.5" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4M12 16.5h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" /></>,
};

export default function AdminIcon({ name, size = 20 }: { name: AdminIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}
