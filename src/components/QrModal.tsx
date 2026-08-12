import { QRCodeSVG } from 'qrcode.react'

type QrModalProps = { url: string; onClose: () => void }

export function QrModal({ url, onClose }: QrModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar código QR">×</button>
        <p className="eyebrow">SUMÁ GENTE</p>
        <h2 id="qr-title">Escaneá y entrá</h2>
        <div className="qr-frame"><QRCodeSVG value={url} size={220} includeMargin /></div>
        <p>Sin descargas ni cuentas. Abrí el link desde el navegador.</p>
      </section>
    </div>
  )
}

