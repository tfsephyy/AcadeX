import { useState, useEffect, useCallback } from 'react'

import { ThemeContext } from './useTheme'
import lightIcon from '../assets/brand/acadex-app-icon-light.svg?no-inline'
import darkIcon from '../assets/brand/acadex-app-icon-dark.svg?no-inline'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('acadex_theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    const icon = document.getElementById('app-icon')
    if (icon) icon.href = theme === 'dark' ? darkIcon : lightIcon
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121614' : '#F6FFF7')
    try {
      localStorage.setItem('acadex_theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
