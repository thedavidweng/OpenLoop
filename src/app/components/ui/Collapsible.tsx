import { useRef, useState, useCallback, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: ReactNode;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = "",
  headerClassName = "",
  contentClassName = "",
  badge,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen ?? uncontrolledOpen;

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (onOpenChange) {
      onOpenChange(next);
    } else {
      setUncontrolledOpen(next);
    }
  }, [isOpen, onOpenChange]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-white ${headerClassName}`}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
        }}
      >
        <div className={`min-h-0 ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}
