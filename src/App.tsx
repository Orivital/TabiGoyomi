import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import { TripListPage } from './pages/TripListPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { NewTripPage } from './pages/NewTripPage'
import { NewEventPage } from './pages/NewEventPage'
import { EditEventPage } from './pages/EditEventPage'
import { InvitePage } from './pages/InvitePage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
                <Route
                  path="/trips/:tripId/events/:eventId/edit"
                  element={<EditEventPage />}
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
