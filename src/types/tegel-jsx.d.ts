/**
 * Intrinsic element typings for Scania Tegel web components.
 * React 19 uses the React.JSX namespace.
 */
import "react";

type TdsBaseProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;

type TdsButtonProps = TdsBaseProps & {
  text?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  fullbleed?: boolean;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tds-button": TdsButtonProps;
      "tds-badge": TdsBaseProps & {
        value?: string | number;
        hidden?: boolean;
        size?: "sm" | "lg";
      };
      "tds-chip": TdsBaseProps & {
        size?: "sm" | "lg";
        type?: "button" | "radio" | "checkbox";
      };
      "tds-block": TdsBaseProps & {
        modeVariant?: "primary" | "secondary";
      };
      "tds-card": TdsBaseProps & {
        header?: string;
        subheader?: string;
        bodyDivider?: boolean;
      };
      "tds-message": TdsBaseProps & {
        header?: string;
        modeVariant?: "information" | "error" | "success" | "warning";
        minimal?: boolean;
      };
      "tds-divider": TdsBaseProps;
      "tds-header": TdsBaseProps;
      "tds-header-title": TdsBaseProps;
      "tds-header-hamburger": TdsBaseProps;
      "tds-header-item": TdsBaseProps;
      "tds-tag": TdsBaseProps & {
        text?: string;
      };
    }
  }
}

export {};
