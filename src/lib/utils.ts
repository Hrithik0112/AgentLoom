import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Class name helper every shadcn and componentry component imports. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
