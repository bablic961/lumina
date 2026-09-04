'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useUi } from '@/store/ui';

/** Image viewer with zoom, rotation and download, driven from the UI store. */
export function Lightbox() {
  const { lightbox, closeLightbox } = useUi();
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (lightbox) {
      setIndex(lightbox.index);
      setZoom(1);
      setRotation(0);
    }
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, lightbox.urls.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if (e.key === '+') setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, closeLightbox]);

  const url = lightbox?.urls[index];

  return (
    <AnimatePresence>
      {lightbox && url ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute top-4 end-4 flex gap-2">
            <IconButton onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} label="Приблизить">
              <ZoomIn className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} label="Отдалить">
              <ZoomOut className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={() => setRotation((r) => r + 90)} label="Повернуть">
              <RotateCw className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={() => window.open(url, '_blank')} label="Скачать">
              <Download className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={closeLightbox} label="Закрыть">
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          {lightbox.urls.length > 1 ? (
            <>
              <IconButton
                className="absolute start-4"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                label="Назад"
              >
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <IconButton
                className="absolute end-4 top-1/2"
                onClick={() => setIndex((i) => Math.min(i + 1, lightbox.urls.length - 1))}
                label="Вперёд"
              >
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            key={url}
            src={url}
            alt=""
            className="max-h-[88vh] max-w-[92vw] cursor-grab rounded-2xl object-contain shadow-glass-lg"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            drag
            dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          />

          {lightbox.urls.length > 1 ? (
            <p className="absolute bottom-5 text-xs font-medium text-white/70">
              {index + 1} / {lightbox.urls.length}
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function IconButton({
  children,
  onClick,
  label,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-xl transition hover:bg-white/20 ${className}`}
    >
      {children}
    </button>
  );
}
