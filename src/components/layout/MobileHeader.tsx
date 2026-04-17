'use client'

import Link from 'next/link'
import { Dices } from 'lucide-react'

export default function MobileHeader() {
  return (
    <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4" style={{ background: 'rgba(248,249,250,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(43,52,55,0.07)' }}>
      <Link href="/app/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
          <Dices size={16} strokeWidth={2.2} className="text-on-primary" />
        </div>
        <span className="font-headline font-black text-[14px] text-on-surface tracking-[-0.02em]">Dice Vault</span>
      </Link>
    </header>
  )
}
