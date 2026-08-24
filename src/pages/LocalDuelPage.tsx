import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { createLocalDuelDeck, LOCAL_DUEL_ROUND_COUNT, type LocalDuelRound, summarizeLocalDuel } from '../lib/localDuel'
import type { PromptPreview, Side } from '../types/game'

type DuelStage = 'setup' | 'player-one' | 'handoff' | 'player-two' | 'reveal' | 'summary'

type DuelPlayers = {
  playerOne: string
  playerTwo: string
}

const sideLabel = (prompt: PromptPreview, side: Side) => side === 'A' ? prompt.sideA : prompt.sideB

export function LocalDuelPage() {
  const [stage, setStage] = useState<DuelStage>('setup')
  const [playerOneInput, setPlayerOneInput] = useState('')
  const [playerTwoInput, setPlayerTwoInput] = useState('')
  const [players, setPlayers] = useState<DuelPlayers | null>(null)
  const [prompts, setPrompts] = useState<PromptPreview[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [rounds, setRounds] = useState<LocalDuelRound[]>([])
  const [playerOneChoice, setPlayerOneChoice] = useState<Side | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  const currentPrompt = prompts[roundIndex]
  const summary = summarizeLocalDuel(rounds)

  function beginDuel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const playerOne = playerOneInput.trim()
    const playerTwo = playerTwoInput.trim()

    if (!playerOne || !playerTwo) {
      setSetupError('Escriban los dos apodos para empezar.')
      return
    }

    if (playerOne.toLocaleLowerCase() === playerTwo.toLocaleLowerCase()) {
      setSetupError('Usen apodos distintos para que cada turno quede claro.')
      return
    }

    setPlayers({ playerOne, playerTwo })
    setPrompts(createLocalDuelDeck())
    setRoundIndex(0)
    setRounds([])
    setPlayerOneChoice(null)
    setSetupError(null)
    setStage('player-one')
  }

  function selectPlayerOneSide(side: Side) {
    setPlayerOneChoice(side)
    setStage('handoff')
  }

  function selectPlayerTwoSide(side: Side) {
    if (!currentPrompt || !playerOneChoice) return

    setRounds((currentRounds) => [...currentRounds, {
      prompt: currentPrompt,
      playerOneChoice,
      playerTwoChoice: side,
    }])
    setStage('reveal')
  }

  function continueAfterReveal() {
    if (roundIndex + 1 === LOCAL_DUEL_ROUND_COUNT) {
      setStage('summary')
      return
    }

    setRoundIndex((index) => index + 1)
    setPlayerOneChoice(null)
    setStage('player-one')
  }

  function restartDuel() {
    setPrompts(createLocalDuelDeck())
    setRoundIndex(0)
    setRounds([])
    setPlayerOneChoice(null)
    setStage('player-one')
  }

  if (stage === 'setup') {
    return (
      <Layout>
        <main className="duel-page duel-setup-page">
          <p className="eyebrow">CARA A CARA · UN SOLO DISPOSITIVO</p>
          <h1>¿Hoy coinciden<br /><em>o van a contramano?</em></h1>
          <p className="duel-intro">Cinco consignas, dos elecciones en secreto y una revelación por ronda. Sin ganador, sin chamuyo.</p>
          <form className="duel-setup-card" onSubmit={beginDuel}>
            <div className="duel-player-input player-one">
              <label htmlFor="duel-player-one">Jugador 1</label>
              <input id="duel-player-one" value={playerOneInput} onChange={(event) => setPlayerOneInput(event.target.value)} maxLength={20} autoComplete="off" placeholder="Tu apodo" />
            </div>
            <div className="duel-versus" aria-hidden="true">vs.</div>
            <div className="duel-player-input player-two">
              <label htmlFor="duel-player-two">Jugador 2</label>
              <input id="duel-player-two" value={playerTwoInput} onChange={(event) => setPlayerTwoInput(event.target.value)} maxLength={20} autoComplete="off" placeholder="Su apodo" />
            </div>
            {setupError && <p className="form-error" role="alert">{setupError}</p>}
            <button className="button button-primary duel-start" type="submit">Empezar Cara a cara <span aria-hidden="true">↗</span></button>
          </form>
          <Link className="text-link" to="/">Volver al inicio</Link>
        </main>
      </Layout>
    )
  }

  if (!players || !currentPrompt && stage !== 'summary') return null

  if (stage === 'handoff') {
    return (
      <Layout>
        <main className="duel-page duel-handoff" aria-live="polite">
          <div className="handoff-orbit" aria-hidden="true"><span>↗</span><span>↙</span></div>
          <p className="eyebrow">ELECCIÓN GUARDADA</p>
          <h1>Pasale el dispositivo<br />a <em>{players.playerTwo}.</em></h1>
          <p>{players.playerOne} ya eligió. Ahora no mires: le toca decidir a {players.playerTwo}.</p>
          <button className="button button-primary" onClick={() => setStage('player-two')}>Estoy listo/a <span aria-hidden="true">→</span></button>
        </main>
      </Layout>
    )
  }

  if (stage === 'summary') {
    return (
      <Layout>
        <main className="duel-page duel-summary" aria-live="polite">
          <p className="eyebrow">CARA A CARA · RESULTADO FINAL</p>
          <h1>{summary.agreementPercentage}%<br /><em>en la misma vereda.</em></h1>
          <p className="duel-intro">{summary.matches === 0 ? 'Hoy eligieron siempre distinto.' : summary.matches === LOCAL_DUEL_ROUND_COUNT ? 'Hoy no encontraron una sola contramano.' : 'Hubo acuerdos, pero también material para discutir.'}</p>
          <section className="duel-stats-card" aria-label="Estadísticas del duelo">
            <div><strong>{summary.matches}</strong><span>coincidencias</span></div>
            <div><strong>{summary.differences}</strong><span>en contramano</span></div>
            <div><strong>{LOCAL_DUEL_ROUND_COUNT}</strong><span>rondas jugadas</span></div>
          </section>
          <section className="duel-divider-card">
            <span>EL TEMA QUE MÁS LOS DIVIDIÓ</span>
            {summary.firstDividingPrompt ? <p>{summary.firstDividingPrompt.text}</p> : <p>Hoy no hubo: estuvieron en la misma vereda en todas.</p>}
          </section>
          <div className="duel-summary-actions">
            <button className="button button-primary" onClick={restartDuel}>Jugar revancha <span aria-hidden="true">↻</span></button>
            <Link className="button button-secondary" to="/">Volver al inicio</Link>
          </div>
        </main>
      </Layout>
    )
  }

  const isPlayerOneTurn = stage === 'player-one'
  const completedRound = rounds[rounds.length - 1]
  const agree = completedRound?.playerOneChoice === completedRound?.playerTwoChoice
  const actingPlayer = isPlayerOneTurn ? players.playerOne : players.playerTwo
  const selectSide = isPlayerOneTurn ? selectPlayerOneSide : selectPlayerTwoSide

  return (
    <Layout>
      <main className={`duel-page duel-game duel-stage-${stage}`}>
        <DuelProgress currentRound={roundIndex} completedRounds={rounds.length} />
        {stage === 'reveal' && completedRound ? (
          <section className="duel-reveal" aria-live="polite">
            <p className="eyebrow">RONDA {roundIndex + 1} · REVELACIÓN</p>
            <h1>{agree ? <>Misma <em>vereda.</em></> : <>En <em>contramano.</em></>}</h1>
            <p className="duel-reveal-copy">{agree ? 'Eligieron la misma postura esta vez.' : 'Esta consigna los dejó en lados distintos.'}</p>
            <div className="duel-split" aria-label="Elecciones reveladas">
              <article className="duel-choice-result player-one"><span>{players.playerOne}</span><b>Postura {completedRound.playerOneChoice}</b><strong>{sideLabel(completedRound.prompt, completedRound.playerOneChoice)}</strong></article>
              <article className="duel-choice-result player-two"><span>{players.playerTwo}</span><b>Postura {completedRound.playerTwoChoice}</b><strong>{sideLabel(completedRound.prompt, completedRound.playerTwoChoice)}</strong></article>
            </div>
            <button className="button button-primary" onClick={continueAfterReveal}>{roundIndex + 1 === LOCAL_DUEL_ROUND_COUNT ? 'Ver resultado final' : 'Siguiente ronda'} <span aria-hidden="true">→</span></button>
          </section>
        ) : (
          <section className="duel-turn" aria-labelledby="duel-prompt">
            <div className={`duel-turn-banner ${isPlayerOneTurn ? 'player-one' : 'player-two'}`}><span>Turno privado</span><strong>Le toca a {actingPlayer}</strong><small>{isPlayerOneTurn ? 'Elegí sin que la otra persona mire.' : `${players.playerOne} ya eligió. Ahora decidí por tu cuenta.`}</small></div>
            <article className="duel-question-card">
              <div className="duel-question-topline"><span>{currentPrompt.category}</span><span>Ronda {roundIndex + 1} / {LOCAL_DUEL_ROUND_COUNT}</span></div>
              <h1 id="duel-prompt">{currentPrompt.text}</h1>
              <div className="duel-side-buttons" role="group" aria-label="Elegí una postura">
                <button className="duel-side side-a" onClick={() => selectSide('A')}><span>Postura A</span><strong>{currentPrompt.sideA}</strong></button>
                <button className="duel-side side-b" onClick={() => selectSide('B')}><span>Postura B</span><strong>{currentPrompt.sideB}</strong></button>
              </div>
            </article>
          </section>
        )}
      </main>
    </Layout>
  )
}

function DuelProgress({ currentRound, completedRounds }: { currentRound: number; completedRounds: number }) {
  return <ol className="duel-progress" aria-label={`Ronda ${currentRound + 1} de ${LOCAL_DUEL_ROUND_COUNT}`}>{Array.from({ length: LOCAL_DUEL_ROUND_COUNT }, (_, index) => <li className={index < completedRounds ? 'complete' : index === currentRound ? 'current' : ''} key={index}><span className="sr-only">Ronda {index + 1}</span></li>)}</ol>
}
