'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import styles from './PillNav.module.css';

// Adapted from React Bits' PillNav (https://reactbits.dev) for use as a
// vertical sidebar list instead of a horizontal top bar: react-router-dom's
// Link -> next/link, the hamburger/mobile-popover subsystem and the image
// logo slot are dropped (this app's sidebar already has its own logo header
// and no mobile breakpoint), and each pill additionally renders a leading
// icon. The hover "fill rises from the bottom" animation is untouched --
// its geometry only depends on each pill's own width/height, so it works
// identically whether pills sit in a row or a column.

export interface PillNavItem {
  label: string;
  href: string;
  ariaLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface PillNavProps {
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
}

export default function PillNav({
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#7c3aed',
  pillColor = 'transparent',
  hoveredPillTextColor = '#ffffff',
  pillTextColor = '#9ca3af',
}: PillNavProps) {
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const circleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const contentRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const contentHoverRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tlRefs = useRef<Array<gsap.core.Timeline | null>>([]);
  const activeTweenRefs = useRef<Array<gsap.core.Tween | null>>([]);

  useEffect(() => {
    const layout = () => {
      itemRefs.current.forEach((pill, i) => {
        if (!pill) return;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        if (!w || !h) return;

        const circle = circleRefs.current[i];
        if (circle) {
          // Radius of the circle whose horizontal chord at height h spans
          // width w -- lets a circle scaling in from the bottom appear to
          // "fill" the pill from below. Depends only on this pill's own
          // rect, so row vs. column layout makes no difference here.
          const R = ((w * w) / 4 + h * h) / (2 * h);
          const D = Math.ceil(2 * R) + 2;
          const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
          const originY = D - delta;

          circle.style.width = `${D}px`;
          circle.style.height = `${D}px`;
          circle.style.bottom = `-${delta}px`;

          gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });
        }

        const content = contentRefs.current[i];
        const contentHover = contentHoverRefs.current[i];
        if (content) gsap.set(content, { y: 0 });
        if (contentHover) gsap.set(contentHover, { y: h + 12, opacity: 0 });

        tlRefs.current[i]?.kill();
        const tl = gsap.timeline({ paused: true });

        if (circle) {
          tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
        }
        if (content) {
          tl.to(content, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        }
        if (contentHover) {
          gsap.set(contentHover, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(contentHover, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }

        tlRefs.current[i] = tl;
      });
    };

    layout();

    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    return () => window.removeEventListener('resize', onResize);
  }, [items, ease]);

  // The active (current page) pill stays permanently filled via the
  // .isActive CSS class instead of the hover timeline, so hover/leave is a
  // no-op for it -- no risk of the animation resetting it to "unfilled".
  const handleEnter = (i: number, href: string) => {
    if (activeHref === href) return;
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' });
  };

  const handleLeave = (i: number, href: string) => {
    if (activeHref === href) return;
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' });
  };

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: pillTextColor,
  } as React.CSSProperties;

  return (
    <nav className={`${styles.pillNav} ${className}`} aria-label="Primary" style={cssVars}>
      <ul className={styles.pillList} role="menubar">
        {items.map((item, i) => {
          const Icon = item.icon;
          const isActive = activeHref === item.href;
          return (
            <li key={item.href} role="none">
              <Link
                href={item.href}
                role="menuitem"
                aria-label={item.ariaLabel || item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`${styles.pill}${isActive ? ` ${styles.isActive}` : ''}`}
                onMouseEnter={() => handleEnter(i, item.href)}
                onMouseLeave={() => handleLeave(i, item.href)}
                ref={el => {
                  itemRefs.current[i] = el;
                }}
              >
                <span
                  className={styles.hoverCircle}
                  aria-hidden="true"
                  ref={el => {
                    circleRefs.current[i] = el;
                  }}
                />
                <span className={styles.labelStack}>
                  <span
                    className={styles.pillContent}
                    ref={el => {
                      contentRefs.current[i] = el;
                    }}
                  >
                    {Icon && <Icon className={styles.pillIcon} />}
                    <span className={styles.pillLabel}>{item.label}</span>
                  </span>
                  <span
                    className={styles.pillContentHover}
                    aria-hidden="true"
                    ref={el => {
                      contentHoverRefs.current[i] = el;
                    }}
                  >
                    {Icon && <Icon className={styles.pillIcon} />}
                    <span className={styles.pillLabel}>{item.label}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
