import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

/**
 * Two routes do not need a routing library. This is the History API plus a subscription.
 *
 * ponytail: no nested routes, no params, no loaders. If this app ever grows a third
 * route with parameters, swap in react-router rather than growing this.
 */

const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function navigate(to: string) {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  window.scrollTo(0, 0);
  notify();
}

export function usePath() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("popstate", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("popstate", onChange);
      };
    },
    () => window.location.pathname,
    () => "/",
  );
}

type LinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

/** Client-side for internal paths, a plain anchor for everything else. */
export function Link({ to, children, ...rest }: LinkProps) {
  const external = /^https?:|^mailto:/.test(to);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modified clicks, so open-in-new-tab keeps working.
    if (
      external ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    )
      return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
