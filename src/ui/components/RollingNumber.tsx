import { AnimatePresence, motion } from 'motion/react'

/** Scoreboard digits that roll when the value changes. */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const digits = String(Math.round(value)).split('')
  return (
    <span className={`roll${className ? ` ${className}` : ''}`} aria-label={String(value)}>
      {digits.map((d, i) => (
        <span className="roll__col" key={digits.length - i} aria-hidden>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={d}
              className="roll__d"
              initial={{ y: '-105%' }}
              animate={{ y: '0%' }}
              exit={{ y: '105%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              {d}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
