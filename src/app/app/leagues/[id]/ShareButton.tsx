'use client'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'

export function ShareButton({ token }: { token: string }) {
  function copy() {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied!')
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-lg transition-colors hover:bg-black/5" title="Copy share link">
      <Link2 size={14} style={{ color: '#9a8878' }} />
    </button>
  )
}
