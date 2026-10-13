import { Check, Sparkles } from "lucide-react";
import { useId, type ReactNode } from "react";
import styles from "./OptionCard.module.css";

/**
 * Opção da entrevista (design/telas.html, tela 2): cartão com rádio ou caixa nativa escondida,
 * marca de seleção, selo "Sugerido", faixa colorida de cortes e motivo quando desabilitada.
 * O nome acessível é só o `label`; o resto entra como descrição.
 */
export function OptionCard({
  type = "radio",
  name,
  value,
  label,
  sub,
  reason,
  suggested = false,
  cuts,
  checked,
  disabled = false,
  size = "big",
  onChange,
  children,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  sub?: ReactNode;
  /** Por que a opção está desabilitada. */
  reason?: string;
  suggested?: boolean;
  /** Quantos cortes desenhar na faixa colorida. */
  cuts?: number;
  checked: boolean;
  disabled?: boolean;
  size?: "big" | "text";
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  const id = useId();
  const describedBy = [sub ? `${id}-sub` : "", reason && disabled ? `${id}-reason` : "", suggested ? `${id}-badge` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <label className={[styles.card, size === "text" ? styles.text : "", disabled ? styles.disabled : ""].filter(Boolean).join(" ")}>
      <input
        type={type}
        className={styles.input}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.check} aria-hidden>
        <Check size={16} strokeWidth={3} />
      </span>
      <span className={styles.label}>{label}</span>
      {sub ? (
        <span id={`${id}-sub`} className={styles.sub}>
          {sub}
        </span>
      ) : null}
      {reason && disabled ? (
        <span id={`${id}-reason`} className={styles.reason}>
          {reason}
        </span>
      ) : null}
      {cuts && cuts > 0 ? (
        <span className={styles.cuts} aria-hidden>
          {Array.from({ length: Math.min(cuts, 24) }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      ) : null}
      {children}
      {suggested ? (
        <span id={`${id}-badge`} className={styles.badge}>
          <Sparkles size={13} strokeWidth={2} aria-hidden />
          Sugerido
        </span>
      ) : null}
    </label>
  );
}
