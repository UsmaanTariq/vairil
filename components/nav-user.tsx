"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, SettingsIcon, LogOutIcon } from "lucide-react";

const user = {
	name: "TrendForge",
	email: "utariq2004@gmail.com",
	avatar: "",
};

async function handleLogout() {
	await fetch("/api/auth/logout", { method: "POST" });
	window.location.href = "/login";
}

export function NavUser() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						aria-label="User menu"
						className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
						type="button"
					/>
				}
			>
				<Avatar className="size-8">
					<AvatarImage src={user.avatar} />
					<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<div className="flex items-center gap-3 px-2 py-1.5">
					<Avatar className="size-10">
						<AvatarImage src={user.avatar} />
						<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="truncate font-medium text-foreground text-sm">{user.name}</p>
						<p className="truncate text-muted-foreground text-xs">{user.email}</p>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UserIcon
						/>
						Account
					</DropdownMenuItem>
					<DropdownMenuItem>
						<SettingsIcon
						/>
						Settings
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						className="w-full cursor-pointer"
						variant="destructive"
						onClick={handleLogout}
					>
						<LogOutIcon
						/>
						Log out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
