export type CheckableRole =
  | "rower"
  | "coach"
  | "admin"
  | "clubAdmin"
  | "federationAdmin"
  | "platformAdmin";

export interface NavItemDef {
  to: string;
  label: string;
  roles?: CheckableRole[];
  group?: string;
  requireAuth?: boolean;
}

export const NAV_CONFIG: NavItemDef[] = [
  { to: "/",      label: "Home"   },
  { to: "/events",label: "Races"  },
  { to: "/about", label: "About", requireAuth: true },

  { to: "/coach/sessions",    label: "Sessions",    roles: ["coach"],                         group: "Coach"   },
  { to: "/rower/my-sessions", label: "My Sessions", roles: ["rower"],                         group: "Athlete" },
  { to: "/my-bookings",       label: "My Bookings", roles: ["rower", "coach"]                                  },

  { to: "/host/events",       label: "Manage Races",roles: ["clubAdmin"],                     group: "Host"    },
  { to: "/host/events/new",   label: "Create Race", roles: ["clubAdmin"],                     group: "Host"    },

  { to: "/admin/platform",    label: "Platform",    roles: ["platformAdmin"],                 group: "Admin"   },
  { to: "/admin/federation",  label: "Federation",  roles: ["federationAdmin"],               group: "Admin"   },
  { to: "/admin/club",        label: "My Club",     roles: ["clubAdmin"],                     group: "Admin"   },
];
