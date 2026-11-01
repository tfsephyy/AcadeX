import { Link } from 'react-router-dom'
import { useTheme } from '../context/useTheme'
import lightLogo from '../assets/brand/acadex-logo-light.svg?no-inline'
import darkLogo from '../assets/brand/acadex-logo-dark.svg?no-inline'
import sidebarLogo from '../assets/brand/acadex-logo-sidebar.svg?no-inline'
import lightIcon from '../assets/brand/acadex-app-icon-light.svg?no-inline'
import darkIcon from '../assets/brand/acadex-app-icon-dark.svg?no-inline'

/** Official outlined artwork from the client's SVG pack; follows the app theme. */
export function BrandImage({ compact = false, variant = 'default', className = '' }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const src = compact ? (dark ? darkIcon : lightIcon)
    : variant === 'sidebar' && !dark ? sidebarLogo : dark ? darkLogo : lightLogo
  return <img src={src} className={`brand-image ${compact ? 'brand-image-icon' : 'brand-image-logo'} ${className}`} alt="AcadeX" width={compact ? 128 : 329} height={compact ? 128 : 94} decoding="async" />
}

export default function Brand({ to = '/', compact = false, variant = 'default', className = '' }) {
  return <Link to={to} className={`brand ${className}`} aria-label="AcadeX home">
    <span className="brand-artwork"><BrandImage compact={compact} variant={variant} /></span>
  </Link>
}
