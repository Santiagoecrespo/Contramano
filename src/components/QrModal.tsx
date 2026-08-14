import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type QrModalProps = { url: string; isLocalPreview: boolean; onClose: () => void }

export function QrModal({ url, isLocalPreview, onClose }: QrModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" aria-describedby="qr-description" onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeButton} className="icon-button" type="button" onClick={onClose} aria-label="Cerrar código QR">×</button>
        <p className="eyebrow">SUMÁ GENTE</p>
        <h2 id="qr-title">Escaneá y entrá</h2>
        <div className="qr-frame"><QRCodeSVG value={url} size={220} includeMargin /></div>
        <p id="qr-description">Sin descargas ni cuentas. Abrí el link desde el navegador.</p>
        {isLocalPreview && <p className="local-share-note" role="status">Estás en local: este QR abre <code>localhost</code> y no sirve desde otro celular. Probalo publicado o con una URL accesible en tu red.</p>}
      </section>
    </div>
  )
}
