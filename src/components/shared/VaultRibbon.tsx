export function VaultRibbon({ ownerName }: { ownerName: string }) {
  return (
    <div
      className="absolute top-2 right-2 px-2 py-0.5 rounded-full font-headline font-bold text-[9px] uppercase tracking-[.06em] whitespace-nowrap z-10 pointer-events-none"
      style={{ background: '#005bc0', color: '#fff' }}
    >
      {ownerName}&apos;s VAULT
    </div>
  )
}
