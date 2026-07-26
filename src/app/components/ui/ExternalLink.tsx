import type { MouseEvent, ReactNode } from "react";
import * as api from "@/app/lib/api";

interface ExternalLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * Anchor that opens in the system browser. Plain target="_blank" has no UI
 * delegate in the packaged WKWebView and can silently do nothing, so the
 * click is routed through the opener plugin; the href stays for semantics,
 * hover preview, and the browser-preview fallback.
 */
export function ExternalLink({ href, className, children }: ExternalLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void api.openExternalUrl(href).catch(() => {});
  };

  return (
    <a href={href} rel="noopener noreferrer" className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
