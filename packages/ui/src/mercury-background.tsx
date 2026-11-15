'use client';
import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createDeterministicBlobs, useLiquidCursorSync } from './liquid-cursor';

interface MercuryBackgroundProps {
  accentColor?: string;
  blobCount?: number;
  className?: string;
}

export const MercuryBackground: React.FC<MercuryBackgroundProps> = ({
  accentColor = '#e0e0e0',
  blobCount = 6,
  className = '',
}) => {
  const reactId = useId();
  const filterId = `gooey-mercury-${reactId.replace(/:/g, '')}`;
  const blobsData = useMemo(
    () =>
      createDeterministicBlobs(blobCount, {
        minSize: 150,
        sizeSpread: 200,
        seedOffset: 23,
      }),
    [blobCount]
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Apply the SVG filter on the client after the SVG element is in the DOM
    if (stageRef.current) {
      stageRef.current.style.filter = `url('#${filterId}')`;
    }
  }, [filterId]);

  useLiquidCursorSync({
    stageRef,
    trackRefs,
    blobRefs,
    parallaxStep: 60,
    enabled: true,
  });

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}>
      <style>{`
        .stage-gooey {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          opacity: 0.6;
          contain: layout style paint;
        }

        .mercury-blob-track {
          position: absolute;
          pointer-events: none;
          will-change: transform;
        }

        .mercury-blob {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, ${accentColor}, #888);
          border-radius: 50%;
          animation: float-demo 20s infinite alternate ease-in-out;
          box-shadow: inset -10px -10px 20px rgba(0,0,0,0.5), 
                      10px 10px 30px rgba(255,255,255,0.2);
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .mercury-blob {
            animation: none !important;
          }
        }

        @keyframes float-demo {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10vw, 20vh) scale(1.2); }
          66% { transform: translate(-5vw, 10vh) scale(0.8); }
          100% { transform: translate(5vw, -10vh) scale(1.1); }
        }
      `}</style>

      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" 
              result="goo" 
            />
          </filter>
        </defs>
      </svg>

      <div className="stage-gooey" id="stage" ref={stageRef}>
        {blobsData.map((data, index) => (
          <div
            key={index}
            ref={(el) => { trackRefs.current[index] = el; }}
            className="mercury-blob-track"
            style={{
              width: `${data.size}px`,
              height: `${data.size}px`,
              left: `${data.left}%`,
              top: `${data.top}%`,
            }}
          >
            <div
              ref={(el) => { blobRefs.current[index] = el; }}
              className="mercury-blob rounded-full pointer-events-none opacity-80"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, #888)`,
                animation: `float-demo 20s infinite alternate ease-in-out`,
                animationDelay: `${data.animationDelay}s`,
                animationDuration: `${data.animationDuration}s`,
                boxShadow: `inset -10px -10px 20px rgba(0,0,0,0.5), 10px 10px 30px rgba(255,255,255,0.1)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MercuryBackground;
