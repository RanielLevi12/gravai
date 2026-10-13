import type { ComponentProps } from "react";
import styles from "./Field.module.css";

type Props = { label: string; hint?: string; multiline?: boolean } & (
  | ({ multiline?: false } & ComponentProps<"input">)
  | ({ multiline: true } & ComponentProps<"textarea">)
);

export function Field(props: Props) {
  const { label, hint, id, className } = props;
  const fieldId = id ?? `campo-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const hintId = hint ? `${fieldId}-dica` : undefined;
  const cls = [styles.control, className].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      {props.multiline ? (
        (() => {
          const { label: _l, hint: _h, multiline: _m, ...rest } = props;
          return <textarea {...rest} id={fieldId} className={cls} aria-describedby={hintId} rows={rest.rows ?? 3} />;
        })()
      ) : (
        (() => {
          const { label: _l, hint: _h, multiline: _m, ...rest } = props;
          return <input {...rest} id={fieldId} className={cls} aria-describedby={hintId} />;
        })()
      )}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
