import { useStore } from '../store'
import { ru } from './ru'
import { en } from './en'

export type TKey = keyof typeof ru
const translations = { ru, en }

export function useT(): (key: TKey) => string {
  const lang = useStore((s) => s.lang)
  return (key: TKey) => (translations[lang][key] as string) ?? key
}
