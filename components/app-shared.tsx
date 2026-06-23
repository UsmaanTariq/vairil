import type { ReactNode } from "react";
import { LayoutDashboardIcon, UsersIcon } from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		label: "Workspace",
		items: [
			{
				title: "Dashboard",
				path: "/",
				icon: <LayoutDashboardIcon />,
			},
			{
				title: "Accounts",
				path: "/accounts",
				icon: <UsersIcon />,
			},
		],
	},
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
];
