import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";

type NativeLikeChangeEvent = {
  target: {
    value: string;
  };
};

type SelectFieldProps = {
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (event: NativeLikeChangeEvent) => void;
  children: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
};

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

type OptionElementProps = {
  value?: string | number;
  children?: ReactNode;
  disabled?: boolean;
};

function optionLabel(content: ReactNode): string {
  if (typeof content === "string" || typeof content === "number") {
    return String(content);
  }

  return Children.toArray(content)
    .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : ""))
    .join("")
    .trim();
}

export function SelectField({
  className = "",
  value,
  defaultValue,
  onChange,
  children,
  disabled = false,
  placeholder = "Выберите значение",
  name,
}: SelectFieldProps) {
  const options = useMemo<SelectOption[]>(
    () =>
      Children.toArray(children)
        .map((child) => {
          if (!isValidElement(child) || child.type !== "option") return null;

          const option = child as ReactElement<OptionElementProps>;
          const optionValue =
            option.props.value == null ? optionLabel(option.props.children) : String(option.props.value);

          return {
            value: optionValue,
            label: optionLabel(option.props.children),
            disabled: Boolean(option.props.disabled),
          };
        })
        .filter(Boolean) as SelectOption[],
    [children],
  );

  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ? String(defaultValue) : options[0]?.value ?? "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controlled = value != null;
  const currentValue = controlled ? String(value) : internalValue;
  const selected = options.find((option) => option.value === currentValue) ?? null;

  useEffect(() => {
    if (!controlled && defaultValue != null) {
      setInternalValue(String(defaultValue));
    }
  }, [controlled, defaultValue]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function selectValue(nextValue: string) {
    if (!controlled) {
      setInternalValue(nextValue);
    }

    onChange?.({ target: { value: nextValue } });
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`selectField ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`.trim()}
    >
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}

      <button
        type="button"
        className="selectField__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`selectField__value ${selected ? "" : "is-placeholder"}`.trim()}>
          {selected?.label || placeholder}
        </span>
        <span className="selectField__chevron">▾</span>
      </button>

      {open ? (
        <div className="selectField__menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className={`selectField__option ${option.value === currentValue ? "is-selected" : ""}`.trim()}
              aria-selected={option.value === currentValue}
              disabled={option.disabled}
              onClick={() => selectValue(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
