'use client'
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export function QRCodeCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: 200,
      margin: 2,
      color: { dark: '#1e1a14', light: '#fefcf8' },
    })
  }, [value])

  return <canvas ref={canvasRef} className="rounded-2xl" />
}
