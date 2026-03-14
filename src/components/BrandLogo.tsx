type BrandLogoProps = {
  variant?: 'header' | 'hero'
}

const logoSrc = `${import.meta.env.BASE_URL}header-logo.png`

export function BrandLogo({ variant = 'header' }: BrandLogoProps) {
  return <img src={logoSrc} alt="旅暦" className={`brand-logo brand-logo--${variant}`} loading="eager" decoding="async" />
}
