import React from "react";
import { baseControlStyle, errorControlStyle } from "./controlStyles";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError, style, ...rest },
  ref,
) {
  return <input ref={ref} style={{ ...baseControlStyle, ...(hasError ? errorControlStyle : {}), ...style }} {...rest} />;
});
