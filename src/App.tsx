import { Route, Routes } from 'react-router-dom'
import { CreateRoomPage } from './pages/CreateRoomPage'
import { JoinRoomPage } from './pages/JoinRoomPage'
import { LandingPage } from './pages/LandingPage'
import { LocalDuelPage } from './pages/LocalDuelPage'
import { RoomPage } from './pages/RoomPage'

export default function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/cara-a-cara" element={<LocalDuelPage />} /><Route path="/crear" element={<CreateRoomPage />} /><Route path="/unirse" element={<JoinRoomPage />} /><Route path="/sala/:code" element={<RoomPage />} /></Routes>
}
