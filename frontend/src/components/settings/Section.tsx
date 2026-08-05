import type { ReactNode } from 'react'

export function Section({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#858481]">{kicker}</div>
        <h3 className="mt-[3px] text-[15px] font-bold text-[#34322d]">{title}</h3>
        <p className="mt-[2px] max-w-[52ch] text-xs leading-relaxed text-[#858481]">{description}</p>
      </div>
      {children}
    </section>
  )
}
