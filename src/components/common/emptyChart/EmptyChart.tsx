import { Stack, Typography } from "@mui/material";
import type { FC } from "react";
import Image from "next/image";

export const EmptyChart: FC = () => {
	return (
		<Stack
			className="w-full items-center justify-center py-8 flex-1"
			spacing={1}
		>
			<Stack
				className="w-full h-full relative"
				style={{ height: 80, maxHeight: 80 }}
			>
				<Image
					src="/images/7466140.png"
					fill
					sizes="80px"
					alt="no data found"
					style={{ objectFit: "contain" }}
					className="grayscale opacity-45"
				/>
			</Stack>
			<Typography variant="body2" color="text.secondary">
				No data available
			</Typography>
		</Stack>
	);
};
