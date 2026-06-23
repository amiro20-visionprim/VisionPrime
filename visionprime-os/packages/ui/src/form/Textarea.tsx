import React from "react";
import { baseControlStyle, errorControlStyle } from "./controlStyles";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { hasError, style, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      style={{ ...baseControlStyle, ...(hasError ? errorControlStyle : {}), resize: "vertical", ...style }}
      {...rest}
    />
  );
});
