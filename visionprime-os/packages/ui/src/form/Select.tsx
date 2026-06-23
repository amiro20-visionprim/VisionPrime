import React from "react";
import { baseControlStyle, errorControlStyle } from "./controlStyles";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  placeholder?: string;
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, hasError, style, ...rest },
  ref,
) {
  return (
    <select ref={ref} style={{ ...baseControlStyle, ...(hasError ? errorControlStyle : {}), ...style }} {...rest}>
      {placeholder ? (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
