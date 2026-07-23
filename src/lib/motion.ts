// GSAP motion presets. GSAP is used to choreograph surrounding UI values
// (counters, fades, draw reveals) and never owns Cytoscape coordinates.
//
// All helpers respect prefers-reduced-motion: when reduced, they resolve
// immediately with the final value.

import gsap from 'gsap';
import type { RefObject } from 'react';

export function motionDefaults(reduced: boolean): gsap.TweenVars {
  return {
    duration: reduced ? 0 : undefined,
    ease: 'power2.out'
  };
}

export function fadeIn(el: Element | null, reduced: boolean, opts: gsap.TweenVars = {}): gsap.core.Tween | null {
  if (!el || reduced) return null;
  return gsap.fromTo(el,
    { autoAlpha: 0, y: 8 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', ...opts }
  );
}

export function staggerIn(els: Element[] | NodeListOf<Element>, reduced: boolean, opts: gsap.TweenVars = {}): gsap.core.Timeline | null {
  if (!els || els.length === 0 || reduced) return null;
  return gsap.timeline()
    .fromTo(els,
      { autoAlpha: 0, scale: 0.7 },
      { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)', stagger: 0.04, ...opts }
    );
}

/** Animates a numeric counter from 0 -> target in `duration` seconds. */
export function animateCounter(
  ref: RefObject<HTMLElement | null>,
  target: number,
  reduced: boolean,
  duration = 0.9
): gsap.core.Tween | null {
  if (!ref.current) return null;
  if (reduced) {
    ref.current.textContent = formatNumber(target);
    return null;
  }
  const obj = { v: 0 };
  return gsap.to(obj, {
    v: target,
    duration,
    ease: 'power2.out',
    onUpdate() {
      if (ref.current) ref.current.textContent = formatNumber(Math.round(obj.v));
    },
    onComplete() {
      if (ref.current) ref.current.textContent = formatNumber(target);
    }
  });
}

export function slideInDrawer(el: HTMLElement | null, open: boolean, reduced: boolean): gsap.core.Tween | null {
  if (!el) return null;
  if (reduced) {
    el.style.transform = open ? 'translateX(0)' : 'translateX(100%)';
    return null;
  }
  return gsap.fromTo(el,
    { x: open ? '100%' : '0%' },
    { x: open ? '0%' : '100%', duration: 0.32, ease: 'power3.out' }
  );
}

export function pulseNodeEmphasis(el: Element | null, reduced: boolean): gsap.core.Tween | null {
  if (!el || reduced) return null;
  return gsap.fromTo(el,
    { scale: 1 },
    { scale: 1.06, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}