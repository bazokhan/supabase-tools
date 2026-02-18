import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function BaseIcon({ children, size = 16, className }: React.PropsWithChildren<IconProps>) {
  return (
    <svg
      className={className}
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
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </BaseIcon>
  );
}

export function IconMigrations(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </BaseIcon>
  );
}

export function IconGraph(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="5" cy="7" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="m7 8 10-2M6.5 8.5 11 16M17.5 6.5 13 16" />
    </BaseIcon>
  );
}

export function IconLogs(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </BaseIcon>
  );
}

export function IconFrontend(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 20h8M10 18v2M14 18v2" />
    </BaseIcon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </BaseIcon>
  );
}

export function IconBack(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h11" />
    </BaseIcon>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 13v6H5V5h6" />
    </BaseIcon>
  );
}

export function IconFile(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </BaseIcon>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </BaseIcon>
  );
}

export function IconSun(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.1 4.9l-2.1 2.1M7 17l-2.1 2.1M19.1 19.1 17 17M7 7 4.9 4.9" />
    </BaseIcon>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </BaseIcon>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </BaseIcon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </BaseIcon>
  );
}

export function IconX(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </BaseIcon>
  );
}

export function IconTable(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M8 4v16M16 4v16" />
    </BaseIcon>
  );
}

export function IconFunction(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 10h4l2 4-2 4H4" />
      <path d="M20 10h-4l-2 4 2 4h4" />
      <path d="M12 4v16" />
    </BaseIcon>
  );
}

export function IconView(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="14" rx="1" />
      <path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6" />
    </BaseIcon>
  );
}

export function IconTrigger(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 8l4-4 4 4" />
      <path d="M8 4v6a4 4 0 0 0 8 0V4" />
      <path d="M12 20v-6" />
    </BaseIcon>
  );
}

export function IconPolicy(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </BaseIcon>
  );
}

export function IconKey(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="8" cy="15" r="3" />
      <path d="m10.5 12.5 6-6" />
      <path d="m15 8 2 2 3-3-2-2" />
    </BaseIcon>
  );
}

export function IconFilter(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3" />
    </BaseIcon>
  );
}

export function IconEnum(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </BaseIcon>
  );
}

export function IconType(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6M12 4v16" />
    </BaseIcon>
  );
}

export function IconColumn(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="4" width="4" height="16" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <rect x="16" y="4" width="4" height="16" rx="1" />
    </BaseIcon>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </BaseIcon>
  );
}

export function IconErd(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="7" height="5" rx="1" />
      <rect x="14" y="5" width="7" height="5" rx="1" />
      <rect x="8" y="14" width="8" height="5" rx="1" />
      <path d="M10 10v2M14 10v2M12 14V10" />
    </BaseIcon>
  );
}

export function IconChart(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-5M12 16V9M17 16v-2" />
    </BaseIcon>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </BaseIcon>
  );
}

export function IconExpand(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-9 9M3 21l9-9" />
    </BaseIcon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </BaseIcon>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m15 18-6-6 6-6" />
    </BaseIcon>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </BaseIcon>
  );
}
