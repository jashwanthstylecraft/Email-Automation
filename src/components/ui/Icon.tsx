import type { LucideIcon } from "lucide-react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  icon: LucideIcon;
  size?: number;
}

/**
 * Single seam between call sites and the icon source. Every icon in the app
 * should render through here so a brand icon set can later replace the
 * `icon` fallback for a given name with zero call-site changes.
 */
export function Icon({ icon: LucideFallback, size = 16, ...props }: IconProps) {
  return <LucideFallback size={size} {...props} />;
}
