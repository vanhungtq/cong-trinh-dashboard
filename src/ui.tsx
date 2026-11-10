import React, { forwardRef } from "react";
import {
  Button as GravityButton,
  TextInput,
  TextArea,
} from "@gravity-ui/uikit";
export const UiButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function UiButton(
  { className = "", children, type = "submit", ...props },
  ref,
) {
  const action = /(^|\s)primary(\s|$)/.test(className),
    small = /(^|\s)small(\s|$)/.test(className),
    icon = className.includes("icon-button");
  const native =
    !className.includes("button") ||
    className.includes("nav-item") ||
    className.includes("project-name") ||
    className.includes("text-button");
  // Composite navigation/cards retain their semantic structure and use the shared theme tokens.
  if (native)
    return (
      <button ref={ref} type={type} className={className} {...props}>
        {children}
      </button>
    );
  return (
    <GravityButton
      ref={ref}
      type={type}
      {...props}
      className={className + " gravity-control"}
      view={action ? "action" : icon ? "flat" : "outlined"}
      size={small ? "s" : "l"}
    >
      {children}
    </GravityButton>
  );
});
export const UiInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function UiInput(
  {
    className = "",
    type = "text",
    value,
    defaultValue,
    onChange,
    disabled,
    id,
    name,
    placeholder,
    autoComplete,
    autoFocus,
    onFocus,
    onBlur,
    onKeyDown,
    ...controlProps
  },
  ref,
) {
  if (
    !["text", "search", "email", "password", "number", "url", "tel"].includes(
      type,
    )
  )
    return (
      <input
        ref={ref}
        className={className + " gravity-native-input"}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        id={id}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        {...controlProps}
      />
    );
  return (
    <TextInput
      className={"gravity-input " + className}
      type={type as "text"}
      size="l"
      value={value === undefined ? undefined : String(value)}
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      onChange={onChange}
      disabled={disabled}
      id={id}
      name={name}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      controlRef={ref}
      controlProps={controlProps}
    />
  );
});
export const UiTextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function UiTextArea(
  {
    className = "",
    value,
    defaultValue,
    onChange,
    disabled,
    id,
    name,
    placeholder,
    rows,
    autoComplete,
    ...props
  },
  ref,
) {
  return (
    <TextArea
      className={"gravity-input " + className}
      size="l"
      value={value === undefined ? undefined : String(value)}
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      onChange={onChange}
      disabled={disabled}
      id={id}
      name={name}
      placeholder={placeholder}
      rows={rows || 3}
      autoComplete={autoComplete}
      controlRef={ref}
      controlProps={props}
    />
  );
});
