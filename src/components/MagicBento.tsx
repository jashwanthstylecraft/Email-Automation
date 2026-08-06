'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import styles from './MagicBento.module.css';

export const DEFAULT_GLOW_COLOR = '99, 102, 241';
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function createParticleElement(x: number, y: number, color: string) {
  const el = document.createElement('div');
  el.className = styles.particle;
  el.style.cssText = `
    left: ${x}px;
    top: ${y}px;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.6);
  `;
  return el;
}

interface BentoCardProps {
  as?: React.ElementType;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  glowColor?: string;
  particleCount?: number;
  enableStars?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  enableBorderGlow?: boolean;
  clickEffect?: boolean;
  disableAnimations?: boolean;
}

export function BentoCard({
  as: Component = 'div',
  href,
  className = '',
  style,
  children,
  glowColor = DEFAULT_GLOW_COLOR,
  particleCount = 8,
  enableStars = true,
  enableTilt = false,
  enableMagnetism = true,
  enableBorderGlow = true,
  clickEffect = true,
  disableAnimations = false,
}: BentoCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isHoveredRef = useRef(false);
  const isMobile = useIsMobile();
  const disabled = disableAnimations || isMobile;

  const clearParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    particlesRef.current.forEach(p => {
      gsap.to(p, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => p.remove(),
      });
    });
    particlesRef.current = [];
  }, []);

  const animateParticles = useCallback(() => {
    const card = cardRef.current;
    if (!card || disabled || !enableStars) return;

    if (!isHoveredRef.current) return;

    const { width, height } = card.getBoundingClientRect();
    for (let i = 0; i < particleCount; i++) {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const particle = createParticleElement(Math.random() * width, Math.random() * height, glowColor);
        cardRef.current.appendChild(particle);
        particlesRef.current.push(particle);

        gsap.fromTo(particle, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
        gsap.to(particle, {
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 80,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });
        gsap.to(particle, { opacity: 0.3, duration: 1.5, ease: 'power2.inOut', repeat: -1, yoyo: true });
      }, i * 100);
      timeoutsRef.current.push(timeoutId);
    }
  }, [particleCount, glowColor, enableStars, disabled]);

  useEffect(() => clearParticles, [clearParticles]);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (disabled) return;
    animateParticles();
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    if (disabled) return;
    clearParticles();

    const card = cardRef.current;
    if (card) {
      if (enableTilt) gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' });
      if (enableMagnetism) gsap.to(card, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
      if (enableBorderGlow) card.style.setProperty('--glow-intensity', '0');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled) return;
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    if (enableTilt) {
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;
      gsap.to(card, { rotateX, rotateY, duration: 0.1, ease: 'power2.out', transformPerspective: 900 });
    }

    if (enableMagnetism) {
      const magnetX = (x - centerX) * 0.03;
      const magnetY = (y - centerY) * 0.03;
      gsap.to(card, { x: magnetX, y: magnetY, duration: 0.3, ease: 'power2.out' });
    }

    if (enableBorderGlow) {
      card.style.setProperty('--glow-x', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--glow-y', `${(y / rect.height) * 100}%`);
      card.style.setProperty('--glow-intensity', '1');
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || !clickEffect) return;
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const maxDistance = Math.max(
      Math.hypot(x, y),
      Math.hypot(x - rect.width, y),
      Math.hypot(x, y - rect.height),
      Math.hypot(x - rect.width, y - rect.height)
    );

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      width: ${maxDistance * 2}px;
      height: ${maxDistance * 2}px;
      border-radius: 50%;
      left: ${x - maxDistance}px;
      top: ${y - maxDistance}px;
      background: radial-gradient(circle, rgba(${glowColor}, 0.35) 0%, rgba(${glowColor}, 0.12) 30%, transparent 70%);
      pointer-events: none;
      z-index: 2;
    `;
    card.appendChild(ripple);
    gsap.fromTo(
      ripple,
      { scale: 0, opacity: 1 },
      { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ripple.remove() }
    );
  };

  const anyProps: Record<string, unknown> = {
    ref: cardRef,
    className: `${className} ${styles.bentoCard} ${enableBorderGlow ? styles.borderGlow : ''}`.trim(),
    style: { ...style, ['--glow-color' as string]: glowColor } as React.CSSProperties,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseMove: handleMouseMove,
    onClick: handleClick,
    'data-bento-card': true,
  };
  if (href) anyProps.href = href;

  return <Component {...anyProps}>{children}</Component>;
}

interface BentoSectionProps {
  children: React.ReactNode;
  className?: string;
  enableSpotlight?: boolean;
  spotlightRadius?: number;
  glowColor?: string;
  disableAnimations?: boolean;
}

export function BentoSection({
  children,
  className = '',
  enableSpotlight = true,
  spotlightRadius = 300,
  glowColor = DEFAULT_GLOW_COLOR,
  disableAnimations = false,
}: BentoSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const disabled = disableAnimations || isMobile || !enableSpotlight;

  useEffect(() => {
    if (disabled) return;

    const spotlight = document.createElement('div');
    spotlight.className = styles.globalSpotlight;
    spotlight.style.background = `radial-gradient(circle, rgba(${glowColor}, 0.15) 0%, rgba(${glowColor}, 0.06) 30%, transparent 70%)`;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const section = sectionRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (!section || !spotlightRef.current) return;
      const sectionRect = section.getBoundingClientRect();
      const mouseInside =
        e.clientX >= sectionRect.left &&
        e.clientX <= sectionRect.right &&
        e.clientY >= sectionRect.top &&
        e.clientY <= sectionRect.bottom;

      const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-bento-card]'));

      if (!mouseInside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 });
        cards.forEach(card => card.style.setProperty('--glow-intensity', '0'));
        return;
      }

      gsap.to(spotlightRef.current, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.1,
        ease: 'power2.out',
      });
      gsap.to(spotlightRef.current, { opacity: 1, duration: 0.2 });

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const cardCenterX = rect.left + rect.width / 2;
        const cardCenterY = rect.top + rect.height / 2;
        const distance = Math.hypot(e.clientX - cardCenterX, e.clientY - cardCenterY) - Math.max(rect.width, rect.height) / 2;
        const effectiveDistance = Math.max(0, distance);

        if (effectiveDistance < spotlightRadius) {
          const relativeX = ((e.clientX - rect.left) / rect.width) * 100;
          const relativeY = ((e.clientY - rect.top) / rect.height) * 100;
          const glowIntensity = Math.max(0, 1 - effectiveDistance / spotlightRadius);
          card.style.setProperty('--glow-x', `${relativeX}%`);
          card.style.setProperty('--glow-y', `${relativeY}%`);
          card.style.setProperty('--glow-intensity', String(glowIntensity * 0.6));
        } else {
          card.style.setProperty('--glow-intensity', '0');
        }
      });
    };

    const handleMouseLeaveDoc = () => {
      if (!section || !spotlightRef.current) return;
      gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3 });
      section.querySelectorAll<HTMLElement>('[data-bento-card]').forEach(card => card.style.setProperty('--glow-intensity', '0'));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeaveDoc);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeaveDoc);
      spotlightRef.current?.remove();
      spotlightRef.current = null;
    };
  }, [disabled, glowColor, spotlightRadius]);

  return (
    <div ref={sectionRef} className={`${styles.bentoSection} ${className}`}>
      {children}
    </div>
  );
}
