import { useCallback, useEffect, useState } from 'react'
import { TabIcons } from './art'
import Calendar from './pages/Calendar'
import Chat from './pages/Chat'
import Recipes from './pages/Recipes'
import Settings from './pages/Settings'
import Sleep from './pages/Sleep'
import Today from './pages/Today'
import Weight from './pages/Weight'
import { seedIfEmpty } from './seed'
import { getPrefs } from './prefs'
import { buzz, sfx, unlockAudio } from './sound'
import Splash from './Splash'

const TABS = [
  { id: 'today', label: 'Food', el: <Today /> },
  { id: 'byte', label: 'Byte', el: <Chat /> },
  { id: 'calendar', label: 'Days', el: <Calendar /> },
  { id: 'weight', label: 'Weight', el: <Weight /> },
  { id: 'sleep', label: 'Sleep', el: <Sleep /> },
  { id: 'recipes', label: 'Meals', el: <Recipes /> },
  { id: 'settings', label: 'Settings', el: <Settings /> },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  // Direction of the last tab change, for the page transition (new tab to the right → slides in from the right).
  const [dir, setDir] = useState<'left' | 'right'>('right')
  const [ready, setReady] = useState(false)
  const [splash, setSplash] = useState(() => getPrefs().splash)
  const hideSplash = useCallback(() => setSplash(false), [])

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true))
  }, [])

  // Pages can ask to switch tab: window.dispatchEvent(new CustomEvent('mt-nav', { detail: 'settings' })).
  useEffect(() => {
    const onNav = (e: Event) => {
      const t = (e as CustomEvent<TabId>).detail
      if (TABS.some((x) => x.id === t)) {
        setDir(TABS.findIndex((x) => x.id === t) > TABS.findIndex((x) => x.id === tab) ? 'right' : 'left')
        setTab(t)
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('mt-nav', onNav)
    return () => window.removeEventListener('mt-nav', onNav)
  }, [tab])

  useEffect(() => {
    unlockAudio()
    // One delegated listener gives every button its 8-bit sound, chosen by what kind of button it is.
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest('button, label.button')
      if (!b) return
      buzz()
      if (b.closest('.tabs')) sfx.select()
      else if (b.matches('.primary, .quick-main')) sfx.coin()
      else if (b.matches('.ghost')) sfx.down()
      else sfx.blip()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <>
      {ready && (
        <Shell
          tab={tab}
          dir={dir}
          setTab={(t) => {
            if (t === tab) return
            setDir(TABS.findIndex((x) => x.id === t) > TABS.findIndex((x) => x.id === tab) ? 'right' : 'left')
            setTab(t)
            window.scrollTo(0, 0)
          }}
        />
      )}
      {splash && <Splash onDone={hideSplash} />}
    </>
  )
}

function Shell({ tab, dir, setTab }: { tab: TabId; dir: 'left' | 'right'; setTab: (t: TabId) => void }) {
  return (
    <div className="app">
      {/* key remounts <main> per tab so the enter animation (index.css, .page-in) replays */}
      <main key={tab} className={`page-in from-${dir}`}>
        {TABS.find((t) => t.id === tab)!.el}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {(() => {
              const Icon = TabIcons[t.id]
              return <Icon />
            })()}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
