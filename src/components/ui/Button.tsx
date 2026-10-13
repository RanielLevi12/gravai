import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import styles from "./Button.module.css";

type Props = {
  variant?: "primary" | "soft";
  icon?: LucideIcon;
  href?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({ variant = "primary", icon: Icon, href, children, className, ...rest }: Props) {
  const cls = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  const content = (
    <>
      {Icon ? <Icon size={20} strokeWidth={2} aria-hidden /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {content}
    </button>
  );
}
