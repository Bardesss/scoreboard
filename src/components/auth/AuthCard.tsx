'use client'

import Link from 'next/link'
import { Dices } from 'lucide-react'

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
              <Dices size={18} strokeWidth={2.2} className="text-on-primary" />
            </div>
            <div>
              <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
              <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
            </div>
          </Link>
        </div>
        <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function UnderlineInput({ label, ...props }: InputProps) {
  return (
    <div className="mb-5">
      <label className="block font-headline font-black text-[9px] uppercase tracking-[.15em] text-outline-variant mb-1">
        {label}
      </label>
      <input
        className="w-full h-11 border-0 border-b border-b-[#d1dce0] focus:border-b-primary rounded-none px-0.5 pb-2.5 font-body text-sm text-on-surface bg-transparent outline-none transition-[border-color] duration-200 placeholder:text-[#c0c8cc] placeholder:italic placeholder:text-[13px]"
        {...props}
      />
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full h-11 bg-primary hover:bg-primary-dim text-on-primary font-headline font-bold text-sm rounded-[10px] transition-all ${className}`}
      style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.28)' }}
      {...props}
    >
      {children}
    </button>
  )
}
