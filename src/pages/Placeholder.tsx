import { useLabels } from '../hooks/useSettings'

interface PlaceholderProps {
  titleKey: string
}

export function Placeholder({ titleKey }: PlaceholderProps) {
  const { t } = useLabels()

  return (
    <div className="anim-fi flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-heading text-xl font-bold">{t(titleKey)}</h1>
      <p className="text-sm text-muted">{t('empty.coming_soon')}</p>
    </div>
  )
}

export default Placeholder
