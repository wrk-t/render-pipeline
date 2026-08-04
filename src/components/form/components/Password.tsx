// external
import { useState } from "react";
// -- component
import { IconButton, InputAdornment } from "@mui/material";
import { Unicon } from "../../common/icon/Unicon";

// types
import type { MouseEventHandler } from "react";
import type { TextField } from "formik-mui";
import type { TFormikField } from "@smartpath/typed-formik-mui";

type TFormikTextField = TFormikField<Parameters<typeof TextField>[0]>;

type TPasswordField = (Component: TFormikTextField) => TFormikTextField;

export const PassowrdField: TPasswordField = (Component) => {
  const PasswordTextField: TFormikTextField = ({ slotProps, ...rest }) => {
    const [show, setShow] = useState(false);

    const handleVisibilityChange: MouseEventHandler = (event) => {
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
              <InputAdornment position="end">
                <IconButton
                  color="primary"
                  className="border-none!"
                  onClick={handleVisibilityChange}
                  onMouseDown={handleVisibilityChange}
                >
                  {show ? (
                    <Unicon name="Visibility" />
                  ) : (
                    <Unicon name="VisibilityOff" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    );
  };

  return PasswordTextField;
};
