import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet on phones, centred dialog on wide screens. Wrap in AnimatePresence. */
export function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        className="sheet__scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet__panel"
        initial={{ y: '100%', opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      >
        <div className="sheet__head">
          <span className="t-label c-court">{title}</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}
