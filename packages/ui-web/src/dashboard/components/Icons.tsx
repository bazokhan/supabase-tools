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
