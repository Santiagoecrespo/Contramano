import { Link } from 'react-router-dom'

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Ir al inicio de Contramano">
      <span className="brand-mark" aria-hidden="true"><i>↯</i></span>
      <span className="brand-wordmark">contramano</span>
    </Link>
  )
}
