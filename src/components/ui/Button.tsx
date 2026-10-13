import Link from "next/link";
import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Button.module.css";

type Common = {
  variant?: "primary" | "soft";
  icon?: LucideIcon;
};

type ButtonAsButton = Common & { href?: undefined } & ComponentProps<"button">;
type ButtonAsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, "href">;

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", icon: Icon, className, children } = props;
  const cls = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  const content = (
    <>
      {Icon ? <Icon size={20} strokeWidth={2} aria-hidden /> : null}
      {children}
    </>
  );

  if (props.href !== undefined) {
    const { variant: _v, icon: _i, className: _c, children: _ch, ...linkRest } = props;
    return (
      <Link {...linkRest} className={cls}>
        {content}
      </Link>
    );
  }

  const { variant: _v, icon: _i, className: _c, children: _ch, href: _h, type = "button", ...btnRest } = props;
  return (
    <button {...btnRest} type={type} className={cls}>
      {content}
    </button>
  );
}
