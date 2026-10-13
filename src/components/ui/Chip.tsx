import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./Chip.module.css";

/** Chip informativo (pílula de 28px). Não é filtro nem botão. */
export function Chip({
  children,
  icon: Icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "saved";
}) {
  return (
    <span className={[styles.chip, tone === "saved" ? styles.saved : ""].filter(Boolean).join(" ")}>
      {Icon ? <Icon size={15} strokeWidth={2} aria-hidden /> : null}
      {children}
    </span>
  );
}

/**
 * Opção de escolha única em formato de pílula (rádio nativo, alvo de toque de 44px).
 * Selecionada = borda primária e fundo `primary-tint`, como as opções da entrevista.
 */
export function ChipOption({
  name,
  value,
  defaultChecked,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: () => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.option}>
      <input
        type="radio"
        className={styles.optionInput}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
      />
      <span className={styles.optionFace}>{children}</span>
    </label>
  );
}
