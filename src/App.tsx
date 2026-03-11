import { Suspense, lazy, useEffect, type ComponentType } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from './components/AuthGuard'
import { clearVitePreloadRecovery } from './lib/vitePreloadRecovery'

function lazyPage<T extends string>(
  load: () => Promise<Record<T, ComponentType>>,
  exportName: T,
) {
  return lazy(async () => ({
    default: (await load())[exportName],
  }))
}

const TripListPage = lazyPage(() => import('./pages/TripListPage'), 'TripListPage')
const TripDetailPage = lazyPage(() => import('./pages/TripDetailPage'), 'TripDetailPage')
const NewTripPage = lazyPage(() => import('./pages/NewTripPage'), 'NewTripPage')
const NewEventPage = lazyPage(() => import('./pages/NewEventPage'), 'NewEventPage')
const EditEventPage = lazyPage(() => import('./pages/EditEventPage'), 'EditEventPage')
const EventMemoriesPage = lazyPage(() => import('./pages/EventMemoriesPage'), 'EventMemoriesPage')
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'), 'NotFoundPage')

function RouteLoadingFallback() {
  return (
    <div className="page">
      <p>読み込み中...</p>
    </div>
  )
}

function PreloadRecoveryReset() {
  useEffect(() => {
    clearVitePreloadRecovery(window)
  }, [])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Suspense fallback={<RouteLoadingFallback />}>
                <>
                  <Routes>
                    <Route path="/" element={<TripListPage />} />
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
                    <Route
                      path="/trips/:tripId/memories"
                      element={<EventMemoriesPage />}
                    />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                  <PreloadRecoveryReset />
                </>
              </Suspense>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
