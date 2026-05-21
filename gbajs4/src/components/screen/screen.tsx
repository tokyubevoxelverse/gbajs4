import { useMediaQuery } from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
import { useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './gameboy.css';
import { Rnd, type Props as RndProps } from 'react-rnd';

import {
  useDragContext,
  useEmulatorContext,
  useInitialBoundsContext,
  useLayoutContext,
  useResizeContext
} from '../../hooks/context.tsx';
import { NavigationMenuWidth } from '../navigation-menu/consts.tsx';
import { GripperHandle } from '../shared/gripper-handle.tsx';

type ScreenWrapperProps = RndProps & { $areItemsDraggable: boolean };

const defaultGBACanvasWidth = 240;
const defaultGBACanvasHeight = 160;

const ScreenWrapper = styled(Rnd, {
  shouldForwardProp: (propName) => propName !== '$areItemsDraggable'
})<ScreenWrapperProps>`
  background-color: transparent;
  overflow: visible;
  width: 100dvw;
  height: calc(100dvw * 2 / 3);

  @media ${({ theme }) => theme.isLargerThanPhone} {
    width: min(
      calc(100dvw - ${NavigationMenuWidth + 35}px),
      calc(85dvh * 3 / 2)
    );
    height: 85dvh;
  }

  @media ${({ theme }) => theme.isMobileLandscape} {
    width: calc(100dvh * (3 / 2));
    height: 100dvh;
  }

  &::after {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    margin: 2px;
    pointer-events: none;
    border: 2px dashed ${({ theme }) => theme.gbaThemeBlue};
    visibility: ${({ $areItemsDraggable }) =>
      $areItemsDraggable ? 'visible' : 'hidden'};
  }
`;

const defaultSize = { width: '', height: '' };

export const Screen = () => {
  const theme = useTheme();
  const isLargerThanPhone = useMediaQuery(theme.isLargerThanPhone, { noSsr: true });
  const isMobileLandscape = useMediaQuery(theme.isMobileLandscape, { noSsr: true });
  const { setCanvas } = useEmulatorContext();
  const { areItemsDraggable } = useDragContext();
  const { areItemsResizable } = useResizeContext();
  const { getLayout, setLayout } = useLayoutContext();
  const { initialBounds, setInitialBound } = useInitialBoundsContext();
  const screenWrapperXStart = isLargerThanPhone ? NavigationMenuWidth + 10 : 0;
  const screenWrapperYStart = isLargerThanPhone && !isMobileLandscape ? 15 : 0;

  const rndRef = useRef<Rnd | null>(null);
  const screenLayout = getLayout('screen');

  const refUpdateDefaultPosition = useCallback(
    (node: Rnd | null) => {
      if (!screenLayout?.size) {
        node?.resizableElement.current?.style.removeProperty('width');
        node?.resizableElement.current?.style.removeProperty('height');
      }
      if (!initialBounds?.screen && node)
        setInitialBound('screen', node.resizableElement.current?.getBoundingClientRect());
      rndRef.current = node;
    },
    [initialBounds?.screen, setInitialBound, screenLayout?.size]
  );

  const refSetCanvas = useCallback((node: HTMLCanvasElement | null) => setCanvas(node), [setCanvas]);

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [particlesOn, setParticlesOn] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Remove stray text nodes that caused visible junk in packaged builds
  useEffect(() => {
    try {
      const body = document.body;
      for (const node of Array.from(body.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = node.textContent || '';
          if (txt.trim().length > 0) body.removeChild(node);
        }
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Apply theme from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pv-theme') || 'default';
      applyThemeAndFrame(stored);
    } catch (e) { /* ignore */ }
  }, []);

  const applyTheme = (name: string) => {
    try {
      const root = document.documentElement;
      Array.from(root.classList).filter((c) => c.startsWith('theme-')).forEach((c) => root.classList.remove(c));
      root.classList.add(`theme-${name}`);
      localStorage.setItem('pv-theme', name);
    } catch (e) { /* ignore */ }
  };

  const updateFrameImageForTheme = (name: string) => {
    const map: Record<string,string> = {
      default: './img/gameBoySquareSmall.png',
      red: './img/GBA_red.png',
      valentines: './img/GBA_Cutiefly.png',
      orange: './img/GBA_orange.png',
      yellow: './img/GBA_yellow.png',
      green: './img/GBA_green.png',
      blue: './img/GBA_blue.png',
      purple: './img/GBA_purple.png',
      pink: './img/GBA_pink.png'
    };
    const img = document.getElementById('gameboyFrame') as HTMLImageElement | null;
    if (img) img.src = map[name] ?? map.default;
  };

  const applyThemeAndFrame = (name: string) => {
    applyTheme(name);
    updateFrameImageForTheme(name);
    try { setCurrentTheme(name); } catch (e) { /* ignore */ }
  };

  const currentDimensions = rndRef.current?.resizableElement.current?.getBoundingClientRect();
  const width = currentDimensions?.width ?? 0;
  const height = currentDimensions?.height ?? 0;
  const position = screenLayout?.position ?? (isMobileLandscape ? {
    x: Math.floor(document.documentElement.clientWidth / 2 - width / 2),
    y: Math.floor(document.documentElement.clientHeight / 2 - height / 2)
  } : { x: screenWrapperXStart, y: screenWrapperYStart });
  const size = screenLayout?.size ?? defaultSize;

  // Particle engine
  useEffect(() => {
    let raf = 0;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let particles: Array<any> = [];
    let tintedImgs: HTMLCanvasElement[] = [];
    let heartImg: HTMLImageElement | HTMLCanvasElement | null = null;

    const isValentines = () => document.documentElement.classList.contains('theme-valentines');

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const spawnParticle = (imgW: number) => {
      const size = Math.max(8, imgW / 8);
      const x = window.innerWidth - (20 + Math.random() * 200);
      const y = 20 + Math.random() * 60;
      const vx = (Math.random() - 0.5) * 0.6;
      const vy = -(0.3 + Math.random() * 0.8);
      const life = 2000 + Math.random() * 3000;
      const tint = (tintedImgs.length > 0) ? tintedImgs[Math.floor(Math.random() * tintedImgs.length)] : (heartImg as any);
      const start = performance.now();
      return { x, y, vx, vy, size, life, tint, start };
    };

    const step = (now: number) => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.25) {
        if (heartImg) particles.push(spawnParticle((heartImg as any).naturalWidth || 32));
      }
      particles = particles.filter((p) => now - p.start < p.life);
      for (const p of particles) {
        const t = (now - p.start) / p.life;
        p.x += p.vx; p.y += p.vy;
        const alpha = 1 - t;
        const s = p.size * (1 + 0.3 * t);
        ctx.globalAlpha = alpha;
        try { ctx.drawImage(p.tint, p.x - s / 2, p.y - s / 2, s, s); } catch (e) { }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(step);
    };

    const prepare = async () => {
      // ensure canvas
      canvas = document.getElementById('pvParticlesCanvas') as HTMLCanvasElement | null;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'pvParticlesCanvas';
        canvas.style.position = 'fixed';
        canvas.style.right = '0';
        canvas.style.top = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '2147483662';
        document.body.appendChild(canvas);
      }
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);

      heartImg = new Image();
      try {
        heartImg.src = new URL('./img/heart.png', document.baseURI).href;
        await new Promise<void>((res) => { (heartImg as HTMLImageElement).onload = () => res(); (heartImg as HTMLImageElement).onerror = () => res(); });
      } catch (e) { /* ignore */ }

      if (!heartImg || !(heartImg as HTMLImageElement).naturalWidth) {
        const fallback = document.createElement('canvas');
        fallback.width = 32; fallback.height = 32;
        const fctx = fallback.getContext('2d')!;
        fctx.fillStyle = '#ff4d6d';
        fctx.beginPath();
        fctx.moveTo(16, 28);
        fctx.bezierCurveTo(16, 28, 2, 18, 6, 9);
        fctx.bezierCurveTo(9, 2, 16, 6, 16, 11);
        fctx.bezierCurveTo(16, 6, 23, 2, 26, 9);
        fctx.bezierCurveTo(30, 18, 16, 28, 16, 28);
        fctx.fill();
        heartImg = new Image();
        heartImg.src = fallback.toDataURL();
        await new Promise<void>((res) => (heartImg as HTMLImageElement).onload = () => res());
      }

      const colors = ['#ff91c2', '#c28bff', '#ff4d6d'];
      tintedImgs = colors.map((c) => {
        const w = (heartImg as HTMLImageElement).naturalWidth || 32;
        const h = (heartImg as HTMLImageElement).naturalHeight || 32;
        const oc = document.createElement('canvas');
        oc.width = w; oc.height = h;
        const octx = oc.getContext('2d')!;
        octx.clearRect(0,0,oc.width,oc.height);
        octx.drawImage(heartImg as any, 0, 0, oc.width, oc.height);
        octx.globalCompositeOperation = 'source-in';
        octx.fillStyle = c; octx.fillRect(0,0,oc.width,oc.height);
        return oc;
      });

      if (isValentines()) {
        const baseW = (heartImg as HTMLImageElement).naturalWidth || 32;
        for (let i = 0; i < 12; i++) particles.push(spawnParticle(baseW));
        raf = requestAnimationFrame(step);
      }
    };

    const mo = new MutationObserver(() => {
      if (!particlesOn) return;
      if (isValentines()) {
        if (!canvas) prepare().catch(() => {});
      } else {
        if (canvas) setParticlesOn(false);
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    if (particlesOn) prepare().catch(() => {});

    return () => {
      mo.disconnect();
      window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
      if (canvas) { canvas.remove(); canvas = null; }
      particles = [];
    };
  }, [particlesOn, mounted, currentTheme]);

  return (
    <ScreenWrapper
      data-testid="screen-wrapper"
      disableDragging={!areItemsDraggable}
      ref={refUpdateDefaultPosition}
      enableResizing={areItemsResizable}
      resizeHandleComponent={{
        topRight: <GripperHandle variation="topRight" />,
        bottomRight: <GripperHandle variation="bottomRight" />,
        bottomLeft: <GripperHandle variation="bottomLeft" />,
        topLeft: <GripperHandle variation="topLeft" />
      }}
      resizeHandleStyles={{
        topRight: { marginTop: '15px', marginRight: '15px' },
        bottomRight: { marginBottom: '15px', marginRight: '15px' },
        bottomLeft: { marginBottom: '15px', marginLeft: '15px' },
        topLeft: { marginTop: '15px', marginLeft: '15px' }
      }}
      position={position}
      size={size}
      onDragStart={() => {
        if (!screenLayout?.originalBounds) setLayout('screen', { originalBounds: rndRef.current?.resizableElement.current?.getBoundingClientRect() });
      }}
      onDragStop={(_, data) => setLayout('screen', { position: { x: data.x, y: data.y } })}
      onResizeStart={() => {
        if (!screenLayout?.originalBounds) setLayout('screen', { originalBounds: rndRef.current?.resizableElement.current?.getBoundingClientRect() });
      }}
      onResizeStop={(_1,_2,ref,_3,position) => setLayout('screen', { size: { width: ref.clientWidth, height: ref.clientHeight }, position: { ...position } })}
      $areItemsDraggable={areItemsDraggable}
    >
      {mounted && createPortal(
        <>
          <button id="themeButton" type="button" onClick={() => setIsThemeOpen(true)} aria-label="Themes">Themes</button>
          <button id="particlesButton" type="button" onClick={() => setParticlesOn((p)=>!p)} aria-label="Particles" title="Toggle particles (valentines theme only)" style={{ display: currentTheme === 'valentines' ? 'block' : 'none' }}>Particles</button>
          <div id="pvLogoText"><strong>Managed by ScriptWizard, Fork of gbajs3</strong></div>
          <img id="pvLogo" src="./img/Logo1.png" alt="Logo" aria-hidden="true" />

          {isThemeOpen && (
            <div className="theme-modal-overlay" onClick={() => setIsThemeOpen(false)}>
              <div className="theme-modal" onClick={(e)=>e.stopPropagation()}>
                <h3>Choose a theme</h3>
                <div className="theme-button-grid">
                  {['default','red','orange','yellow','green','blue','pink','purple','valentines'].map((t) => (
                    <button key={t} className="theme-btn" onClick={() => { applyThemeAndFrame(t); setIsThemeOpen(false); }}>{t[0].toUpperCase()+t.slice(1)}</button>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'center',marginTop:12}}>
                  <button className="theme-close" onClick={() => setIsThemeOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </>, document.body)
      }

      <div className="gameboydiv">
        <img id="gameboyFrame" src="./img/gameBoySquareSmall.png" alt="gameboy-frame" />
        <canvas id="gameboyScreen" data-testid="screen-wrapper:render-canvas" ref={refSetCanvas} width={defaultGBACanvasWidth} height={defaultGBACanvasHeight} />
        <button id="gameStartBtn" type="button" aria-hidden />
        <button id="gameResizeBtn" type="button" aria-hidden />
      </div>
    </ScreenWrapper>
  );
};
