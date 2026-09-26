import styles from './TimeMachineIcon.module.css'

interface TimeMachineIconProps {
  size: number
  strokeWidth: number
}

// The wordmark's clock (lucide's History icon) with its hands split out so they
// can run backwards: the minute hand sweeps back every 8s, the hour hand every
// 96s. Pure CSS; still under prefers-reduced-motion.
export function TimeMachineIcon({ size, strokeWidth }: TimeMachineIconProps) {
  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <line className={styles.minute} x1="12" y1="12" x2="12" y2="7" />
      <line className={styles.hour} x1="12" y1="12" x2="16" y2="14" />
    </svg>
  )
}
