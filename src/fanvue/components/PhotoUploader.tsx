import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { useToast } from './Toast'
import { useTelegram } from '../hooks/useTelegram'

interface Props {
  photoKey: string
  label: string
  hint?: string
  aspect?: 'square' | 'wide'
  maxBytes?: number
}

export default function PhotoUploader({
  photoKey, label, hint, aspect = 'wide', maxBytes = 1.5 * 1024 * 1024,
}: Props) {
  const photos = useStore((s) => s.photos)
  const setPhoto = useStore((s) => s.setPhoto)
  const lang = useStore((s) => s.lang)
  const toast = useToast()
  const { haptic } = useTelegram()
  const fileRef = useRef<HTMLInputElement>(null)

  const current = photos[photoKey]

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxBytes) {
      toast.show(lang === 'ru' ? 'Файл слишком большой' : 'File too large', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(photoKey, reader.result as string)
      haptic('success')
      toast.show(lang === 'ru' ? 'Фото загружено' : 'Photo uploaded', 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRemove = () => {
    setPhoto(photoKey, null)
    haptic('warning')
    toast.show(lang === 'ru' ? 'Фото удалено' : 'Photo removed', 'info')
  }

  return (
    <div className="photo-uploader">
      <div className="row-between mb-2">
        <div className="t-sm fw-bold">{label}</div>
        <AnimatePresence>
          {current && (
            <motion.button
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleRemove}
              style={{
                padding: '4px 10px', borderRadius: 9999, fontSize: 11,
                background: 'rgba(239,68,68,0.15)', color: 'var(--red)', fontWeight: 700,
              }}
            >
              🗑 {lang === 'ru' ? 'Удалить' : 'Remove'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        className="photo-slot"
        onClick={() => fileRef.current?.click()}
        whileTap={{ scale: 0.98 }}
        style={{
          aspectRatio: aspect === 'square' ? '1 / 1' : '16 / 9',
        }}
      >
        {current ? (
          <img src={current} alt={label} className="photo-slot-img" />
        ) : (
          <div className="photo-slot-empty">
            <div style={{ color: 'var(--brand)', opacity: 0.5, marginBottom: 6 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <div className="t-xs t-muted">
              {lang === 'ru' ? 'Нажмите для загрузки' : 'Tap to upload'}
            </div>
          </div>
        )}
      </motion.button>

      {hint && <div className="t-xs t-muted mt-2">{hint}</div>}

      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  )
}
