// external

"use client";

// -- component
import type { TFormikField } from "@smartpath/typed-formik-mui";
import type { TextField } from "formik-mui";

// types
import type { MouseEventHandler } from "react";
import { useState } from "react";
import { Unicon } from "../../common/icon/Unicon";

type TFormikTextField = TFormikField<Parameters<typeof TextField>[0]>;

type TPasswordField = (Component: TFormikTextField) => TFormikTextField;

export const PassowrdField: TPasswordField = (Component) => {
	const PasswordTextField: TFormikTextField = ({ slotProps, ...rest }) => {
		const [show, setShow] = useState(false);

		const handleVisibilityChange: MouseEventHandler<HTMLButtonElement> = (
			event,
		) => {
			event.preventDefault();
			event.stopPropagation();

			setShow((prev) => !prev);
		};

		return (
			<Component
				{...rest}
				type={show ? "text" : "password"}
				slotProps={{
					...slotProps,
					input: {
						endAdornment: (
							<span className="flex items-center">
								{/* A native button inside the input's adornment: the wrapper
								    (MUI TextField here) still owns the field chrome. */}
								<button
									type="button"
									aria-label={show ? "Hide password" : "Show password"}
									className="flex size-9 items-center justify-center rounded-md border-none bg-transparent text-primary transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
									onClick={handleVisibilityChange}
									onMouseDown={handleVisibilityChange}
								>
									{show ? (
										<Unicon name="Visibility" />
									) : (
										<Unicon name="VisibilityOff" />
									)}
								</button>
							</span>
						),
					},
				}}
			/>
		);
	};

	return PasswordTextField;
};
