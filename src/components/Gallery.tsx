"use client";

import { useState } from "react";

interface Props {
  images: string[];
  alt: string;
}

/**
 * Galería mínima: imagen grande + miniaturas. Se usa `<img>` plano porque
 * las URLs de assets tienen caracteres sin encodear y no vale la pena
 * configurar `next/image` para el ejercicio.
 */
export function Gallery({ images, alt }: Props) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  if (images.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-zinc-200 text-sm text-zinc-500">
        Sin imágenes
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={alt} className="aspect-video w-full object-contain" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Imagen ${i + 1}`}
                aria-current={i === index}
                className={`block h-16 w-24 overflow-hidden rounded border-2 ${
                  i === index ? "border-zinc-900" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
