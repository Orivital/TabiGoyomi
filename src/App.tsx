import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import { TripListPage } from './pages/TripListPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { NewTripPage } from './pages/NewTripPage'
import { NewEventPage } from './pages/NewEventPage'
import { InvitePage } from './pages/InvitePage'
import { DebugPage } from './pages/DebugPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/debug" element={<DebugPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Routes>
                <Route path="/" element={<TripListPage />} />
                <Route path="/invite" element={<InvitePage />} />
                <Route path="/trips/new" element={<NewTripPage />} />
                <Route path="/trips/:id" element={<TripDetailPage />} />
                <Route
                  path="/trips/:tripId/days/:dayId/events/new"
                  element={<NewEventPage />}
                />
              </Routes>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
