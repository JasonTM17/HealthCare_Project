"use client";

import { useEffect, useRef } from "react";

/**
 * Public-facing elements that can receive a subtle, one-time entrance motion.
 * Nothing is hidden by this component: CSS should animate only after
 * `is-motion-visible` is added by IntersectionObserver.
 */
export const DEFAULT_PUBLIC_REVEAL_SELECTOR = [
  ".hero-copy > *",
  ".hero-visual",
  ".hero-assurance__item",
  ".care-link",
  ".care-experience__visual",
  ".care-experience__copy > *",
  ".care-experience__moments article",
  ".section-heading",
  ".specialty-aside",
  ".specialty-row",
  ".hm-specialty-card",
  ".doctor-card",
  ".package-feature",
  ".package-row",
  ".journey-panel",
  ".journey-step",
  ".branch-feature",
  ".branch-row",
  ".hm-branch-card",
  ".video-card",
  ".article-row",
  ".cta-panel",
  ".resource-page__header",
  ".resource-hero-card",
  ".resource-panel",
  ".resource-step-card",
  ".booking-panel",
  ".catalog-card",
  ".faq-item",
  ".about-hero__copy > *",
  ".about-hero__visual",
  ".about-values > *",
  ".about-values__list article",
  ".about-network > *",
  ".about-closing > *",
].join(",");

export interface PublicMotionProps {
  /** Override this when a page introduces a new public card or section type. */
  revealSelector?: string;
  /** Sticky navigation element that receives scroll state classes. */
  navigationSelector?: string;
}

const CANDIDATE_CLASS = "public-motion-candidate";
const VISIBLE_CLASS = "is-motion-visible";
const IMMEDIATE_CLASS = "is-motion-immediate";
const ROOT_ENABLED_CLASS = "public-motion-enabled";
const ROOT_REDUCED_CLASS = "public-motion-reduced";
const ROOT_SCROLLED_CLASS = "public-page--has-scrolled";

export default function PublicMotion({
  revealSelector = DEFAULT_PUBLIC_REVEAL_SELECTOR,
  navigationSelector = ".site-nav",
}: PublicMotionProps) {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const progress = progressRef.current;
    const navigation = document.querySelector<HTMLElement>(navigationSelector);
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const candidates = new Set<HTMLElement>();
    let revealObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let animationFrame = 0;
    let lastScrollY = Math.max(window.scrollY, 0);
    let staggerCursor = 0;

    const setReducedMotionClass = (): void => {
      root.classList.toggle(ROOT_REDUCED_CLASS, reducedMotionQuery.matches);

      if (reducedMotionQuery.matches) {
        candidates.forEach((element) => {
          element.classList.add(VISIBLE_CLASS, IMMEDIATE_CLASS);
          revealObserver?.unobserve(element);
        });
      }
    };

    const markCandidate = (element: HTMLElement): void => {
      if (candidates.has(element)) return;

      candidates.add(element);
      element.classList.add(CANDIDATE_CLASS);
      element.style.setProperty("--public-motion-delay", `${(staggerCursor % 5) * 65}ms`);
      staggerCursor += 1;

      const bounds = element.getBoundingClientRect();
      const isAlreadyVisible = bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0;

      if (reducedMotionQuery.matches || isAlreadyVisible || !revealObserver) {
        element.classList.add(VISIBLE_CLASS, IMMEDIATE_CLASS);
        return;
      }

      revealObserver.observe(element);
    };

    const collectCandidates = (scope: ParentNode): void => {
      try {
        scope.querySelectorAll<HTMLElement>(revealSelector).forEach(markCandidate);
      } catch {
        // Invalid custom selectors must not affect page rendering.
      }
    };

    if ("IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const element = entry.target as HTMLElement;
            element.classList.add(VISIBLE_CLASS);
            revealObserver?.unobserve(element);
          });
        },
        {
          rootMargin: "0px 0px -9%",
          threshold: 0.08,
        },
      );

      collectCandidates(document);

      mutationObserver = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;

            try {
              if (node.matches(revealSelector)) markCandidate(node);
              collectCandidates(node);
            } catch {
              // Keep asynchronously rendered content visible for invalid selectors.
            }
          });
        });
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
      root.classList.add(ROOT_ENABLED_CLASS);
    }

    const updateScrollState = (): void => {
      animationFrame = 0;
      const scrollY = Math.max(window.scrollY, 0);
      const scrollableDistance = Math.max(root.scrollHeight - window.innerHeight, 1);
      const progressValue = Math.min(scrollY / scrollableDistance, 1);
      const hasScrolled = scrollY > 16;
      const delta = scrollY - lastScrollY;

      progress?.style.setProperty("--public-scroll-progress", progressValue.toFixed(4));
      root.classList.toggle(ROOT_SCROLLED_CLASS, hasScrolled);
      navigation?.classList.toggle("site-nav--scrolled", hasScrolled);

      if (!hasScrolled) {
        navigation?.classList.remove("site-nav--scrolling-down", "site-nav--scrolling-up");
      } else if (Math.abs(delta) >= 5) {
        navigation?.classList.toggle("site-nav--scrolling-down", delta > 0);
        navigation?.classList.toggle("site-nav--scrolling-up", delta < 0);
      }

      lastScrollY = scrollY;
    };

    const requestScrollUpdate = (): void => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateScrollState);
    };

    setReducedMotionClass();
    updateScrollState();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
    reducedMotionQuery.addEventListener("change", setReducedMotionClass);

    return () => {
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      reducedMotionQuery.removeEventListener("change", setReducedMotionClass);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      revealObserver?.disconnect();
      mutationObserver?.disconnect();

      candidates.forEach((element) => {
        element.classList.remove(CANDIDATE_CLASS, VISIBLE_CLASS, IMMEDIATE_CLASS);
        element.style.removeProperty("--public-motion-delay");
      });
      navigation?.classList.remove(
        "site-nav--scrolled",
        "site-nav--scrolling-down",
        "site-nav--scrolling-up",
      );
      root.classList.remove(ROOT_ENABLED_CLASS, ROOT_REDUCED_CLASS, ROOT_SCROLLED_CLASS);
      progress?.style.removeProperty("--public-scroll-progress");
    };
  }, [navigationSelector, revealSelector]);

  return <div aria-hidden="true" className="public-scroll-progress" ref={progressRef} />;
}
