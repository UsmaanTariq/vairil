import { cn } from "@/lib/utils";

function StatusIndicator({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="status-indicator"
			className={cn("relative mr-2 inline-flex size-2", className)}
			{...props}
		>
			<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
			<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
		</span>
	);
}

export { StatusIndicator };
