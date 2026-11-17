import Image from "next/image";
import type { FC } from "react";

export const EmptyChart: FC = () => {
	return (
		<div className="flex w-full flex-1 flex-col items-center justify-center gap-2 py-8">
			<div className="relative h-20 w-full">
				<Image
					src="/images/7466140.png"
					fill
					sizes="80px"
					alt="no data found"
					className="object-contain grayscale opacity-45"
				/>
			</div>
			<p className="text-sm text-muted-foreground">No data available</p>
		</div>
	);
};
