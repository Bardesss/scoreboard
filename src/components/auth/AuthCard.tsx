'use client'

import Link from 'next/link'
import { Dices } from 'lucide-react'

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: '#f5a623', boxShadow: '0 4px 16px rgba(245,166,35,0.3)' }}>
              <Dices size={18} strokeWidth={2.2} style={{ color: '#1c1408' }} />
            </div>
            <div>
              <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
              <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
            </div>
          </Link>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-8" style={{ boxShadow: '0 2px 16px rgba(30,26,20,0.07)', border: '1px solid rgba(245,166,35,0.08)' }}>
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
        className="w-full h-11 border-0 border-b border-b-[#c5b89f] focus:border-b-primary rounded-none px-0.5 pb-2.5 font-body text-sm text-on-surface bg-transparent outline-none transition-[border-color] duration-200 placeholder:text-[#c5b89f] placeholder:italic placeholder:text-[13px]"
        {...props}
      />
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full h-11 bg-primary hover:bg-primary-dim text-on-primary font-headline font-bold text-sm rounded-[10px] transition-all ${className}`}
      style={{ boxShadow: '0 4px 14px rgba(245,166,35,0.28)' }}
      {...props}
    >
      {children}
    </button>
  )
}
