import { TextField, FastTextField } from "@smartpath/typed-formik-mui";
import { PassowrdField } from "./components/Password";

// custom field
export const PasswordTextField = PassowrdField(TextField);
export const FastPasswordTextField = PassowrdField(FastTextField);
