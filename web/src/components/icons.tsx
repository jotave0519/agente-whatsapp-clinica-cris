import { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement> & { d: string }) {
  const { d, ...rest } = props;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={d} />
    </svg>
  );
}

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35" />
);
export const BellIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
);
export const LogOutIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
);
export const PlusIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M12 5v14M5 12h14" />;
export const ChevronLeftIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="m15 18-6-6 6-6" />;
export const ChevronRightIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="m9 18 6-6-6-6" />;
export const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
);
export const PencilIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
);
export const TrendingUpIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="m23 6-9.5 9.5-5-5L1 18M17 6h6v6" />
);
export const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M5 12h14M12 5l7 7-7 7" />;
export const SunIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
);
export const MoonIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />;
export const HomeIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M9 22V12h6v10" />
);
export const CalendarIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
);
export const UsersIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
);
export const MessageCircleIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
);
export const MoreIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props} d="M4 12h.01M12 12h.01M20 12h.01M4 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM11 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM19 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" />
);
export const XIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M18 6 6 18M6 6l12 12" />;
export const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props} d="M19 12H5M12 19l-7-7 7-7" />;
export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon
    {...props}
    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
  />
);
