'use client';
import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createDeterministicBlobs, useLiquidCursorSync } from './liquid-cursor';

const NeuralAccessLogin: React.FC<{ 
    children?: React.ReactNode; 
    title?: string; 
    subtitle?: string; 
    footer?: React.ReactNode; 
    withWaterEffect?: boolean;
    containerClassName?: string;
}> = ({ children, title = 'NEURAL', subtitle = 'ACCESS', withWaterEffect = false, containerClassName }) => {
    const reactId = useId();
    const filterId = `gooey-${reactId.replace(/:/g, '')}`;
    const blobsData = useMemo(
        () =>
            createDeterministicBlobs(withWaterEffect ? 4 : 5, {
                minSize: 140,
                sizeSpread: 180,
                seedOffset: withWaterEffect ? 3 : 11,
            }),
        [withWaterEffect]
    );
    const stageRef = useRef<HTMLDivElement | null>(null);
    const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
    const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        // Apply the SVG filter on the client to create the water/liquid effect
        if (stageRef.current) {
            stageRef.current.style.filter = withWaterEffect ? `url('#${filterId}')` : 'none';
        }
    }, [filterId, withWaterEffect]);

    useLiquidCursorSync({
        stageRef,
        trackRefs,
        blobRefs,
        parallaxStep: withWaterEffect ? 65 : 48,
        enabled: true,
    });

    return (
        <div className="mercury-wrapper">
            <style>{`
                :root {
                    --bg: #E8F6FF;
                    --mercury: #3BA7F2;
                    --mercury-dark: #0B3D91;
                    --accent: #0B3D91;
                    --text-dim: #0B3D91;
                }

                .mercury-wrapper {
                    background-color: var(--bg);
                    color: var(--accent);
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    min-height: 100vh;
                    width: 100%;
                    overflow-x: hidden;
                    overflow-y: auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    isolation: isolate;
                    padding: 48px 16px;
                }

                .mercury-wrapper * {
                    box-sizing: border-box;
                    -webkit-font-smoothing: antialiased;
                }

                .stage {
                    position: fixed;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                    opacity: 0.65;
                    pointer-events: none;
                    overflow: hidden;
                    contain: layout style paint;
                }

                .blob-track {
                    position: absolute;
                    pointer-events: none;
                    will-change: transform;
                }

                .blob {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(circle at 35% 35%, var(--mercury) 0%, var(--mercury-dark) 85%);
                    border-radius: 50%;
                    filter: blur(18px);
                    -webkit-filter: blur(18px);
                    animation: float 20s infinite alternate ease-in-out;
                    box-shadow: inset -8px -8px 18px rgba(0,0,0,0.25), 
                                8px 8px 24px rgba(255,255,255,0.2);
                    will-change: transform;
                }

                @media (prefers-reduced-motion: reduce) {
                    .blob {
                        animation: none !important;
                    }
                }

                @keyframes float {
                    0% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(10vw, 20vh) scale(1.2); }
                    66% { transform: translate(-5vw, 10vh) scale(0.8); }
                    100% { transform: translate(5vw, -10vh) scale(1.1); }
                }

                .auth-container {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 440px;
                    padding: 40px;
                }

                .header {
                    margin-bottom: 60px;
                    text-align: left;
                }

                .brand-id {
                    font-family: 'Space Mono', monospace;
                    font-size: 10px;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    color: var(--text-dim);
                    margin-bottom: 8px;
                    display: block;
                }

                .header h1 {
                    font-family: var(--font-heading, 'League Spartan', sans-serif);
                    font-weight: 800;
                    font-size: clamp(2rem, 7.5vw, 3rem);
                    line-height: 0.95;
                    letter-spacing: -1.5px;
                    margin-left: -2px;
                    margin-top: 0;
                    word-break: break-word;
                }

                @media (max-width: 640px) {
                    .mercury-wrapper {
                        padding: 32px 14px;
                    }
                    .auth-container {
                        padding: 24px 16px;
                        max-width: 100%;
                    }
                    .header {
                        margin-bottom: 32px;
                    }
                    .header h1 {
                        font-size: clamp(1.85rem, 6.5vw, 2.4rem);
                        letter-spacing: -0.5px;
                    }
                }

                .form-group {
                    position: relative;
                    margin-bottom: 30px;
                    transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
                }

                .form-group:focus-within {
                    transform: translateX(10px);
                }

                .form-group label {
                    display: block;
                    font-family: 'Space Mono', monospace;
                    font-size: 11px;
                    color: var(--text-dim);
                    margin-bottom: 12px;
                    text-transform: uppercase;
                }

                .form-group input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid rgba(11, 61, 145, 0.2);
                    color: var(--accent);
                    padding: 12px 0;
                    font-size: 18px;
                    outline: none;
                    transition: border-color 0.4s;
                }

                input[type="password"]::-ms-reveal,
                input[type="password"]::-ms-clear {
                    display: none;
                }

                .input-glow {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 0%;
                    height: 2px;
                    background: var(--mercury);
                    transition: width 0.6s cubic-bezier(0.2, 1, 0.3, 1);
                    box-shadow: 0 0 15px var(--mercury);
                }

                .form-group input:focus + .input-glow {
                    width: 100%;
                }

                .submit-wrap {
                    margin-top: 50px;
                    position: relative;
                }

                .btn-base {
                    background: var(--accent);
                    color: #E8F6FF;
                    border: none;
                    padding: 20px 40px;
                    font-size: 14px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    cursor: pointer;
                    width: 100%;
                    position: relative;
                    z-index: 2;
                    transition: letter-spacing 0.3s;
                }

                .btn-base:hover {
                    letter-spacing: 4px;
                }

                .mercury-drop {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 100%;
                    height: 100%;
                    background: var(--mercury);
                    transform: translate(-50%, -50%);
                    z-index: 1;
                    border-radius: 50px;
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .submit-wrap:hover .mercury-drop {
                    transform: translate(-50%, -50%) scale(1.05, 1.2);
                    filter: brightness(1.2);
                }

                .footer-nav {
                    margin-top: 40px;
                    display: flex;
                    justify-content: space-between;
                    font-family: 'Space Mono', monospace;
                    font-size: 10px;
                }

                .footer-nav a {
                    color: var(--text-dim);
                    text-decoration: none;
                    transition: color 0.3s;
                }

                .footer-nav a:hover {
                    color: var(--mercury);
                }

                .svg-filter-hidden {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    border: 0;
                    pointer-events: none;
                }
            `}</style>

            <svg className="svg-filter-hidden" aria-hidden="true">
                <defs>
                    <filter 
                        id={filterId} 
                        colorInterpolationFilters="sRGB" 
                        x="-20%" 
                        y="-20%" 
                        width="140%" 
                        height="140%"
                    >
                        <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                        <feColorMatrix 
                            in="blur" 
                            mode="matrix" 
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" 
                            result="goo" 
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>

            <div className="stage" id="stage" ref={stageRef}>
                {blobsData.map((data, index) => (
                    <div
                        key={index}
                        ref={(el) => { trackRefs.current[index] = el; }}
                        className="blob-track"
                        style={{
                            width: `${data.size}px`,
                            height: `${data.size}px`,
                            left: `${data.left}%`,
                            top: `${data.top}%`,
                        }}
                    >
                        <div
                            ref={(el) => { blobRefs.current[index] = el; }}
                            className="blob"
                            style={{
                                animationDelay: `${data.animationDelay}s`,
                                animationDuration: `${data.animationDuration}s`,
                            }}
                        />
                    </div>
                ))}
            </div>

            <main className={`auth-container ${containerClassName || ''}`}>
                <header className="header">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="font-extrabold tracking-[6px] text-[var(--accent)] text-sm font-heading">NEWSIM</span>
                        <span className="w-1 h-1 rounded-full bg-[var(--accent)]/30" />
                        <span className="font-mono text-xs tracking-[2px] uppercase text-[var(--accent)]/80">Maritime Training Center</span>
                    </div>
                    <h1>{title}<br/>{subtitle}</h1>
                </header>
                {children}
            </main>
        </div>
    );
};

export { NeuralAccessLogin };
