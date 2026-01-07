import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RequireAuth } from './auth/RequireAuth.jsx'
import { AppLayout } from './components/layout/AppLayout.jsx'
import { Home } from './pages/Home.jsx'
import { Login } from './pages/auth/Login.jsx'
import { Register } from './pages/auth/Register.jsx'
import { BuyerToday } from './pages/buyer/BuyerToday.jsx'
import { BuyerJobs } from './pages/buyer/BuyerDashboard.jsx'
import { BuyerPostJob } from './pages/buyer/BuyerPostJob.jsx'
import { BuyerJobDetail } from './pages/buyer/BuyerJobDetail.jsx'
import { BuyerProviders } from './pages/buyer/BuyerProviders.jsx'
import { BuyerJobEscrow } from './pages/buyer/BuyerJobEscrow.jsx'
import { ArtisanDashboard } from './pages/artisan/ArtisanDashboard.jsx'
import { ArtisanJobDetail } from './pages/artisan/ArtisanJobDetail.jsx'
import { FarmerDashboard } from './pages/farmer/FarmerDashboard.jsx'
import { FarmerListProduct } from './pages/farmer/FarmerListProduct.jsx'
import { MarketplaceBrowse } from './pages/marketplace/MarketplaceBrowse.jsx'
import { MarketplaceProductDetail } from './pages/marketplace/MarketplaceProductDetail.jsx'
import { AdminDashboard } from './pages/admin/AdminDashboard.jsx'
import { NotFound } from './pages/NotFound.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/buyer"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerToday />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/jobs"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerJobs />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/providers"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerProviders />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/jobs/new"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerPostJob />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/jobs/:id"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerJobDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/jobs/:id/escrow"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerJobEscrow />
              </RequireAuth>
            }
          />

          <Route
            path="/artisan"
            element={
              <RequireAuth roles={['artisan']}>
                <ArtisanDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/artisan/jobs/:id"
            element={
              <RequireAuth roles={['artisan']}>
                <ArtisanJobDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/farmer"
            element={
              <RequireAuth roles={['farmer']}>
                <FarmerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/farmer/products/new"
            element={
              <RequireAuth roles={['farmer']}>
                <FarmerListProduct />
              </RequireAuth>
            }
          />

          <Route
            path="/marketplace"
            element={
              <RequireAuth roles={['buyer']}>
                <MarketplaceBrowse />
              </RequireAuth>
            }
          />
          <Route
            path="/marketplace/products/:id"
            element={
              <RequireAuth roles={['buyer']}>
                <MarketplaceProductDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAuth roles={['admin']}>
                <AdminDashboard />
              </RequireAuth>
            }
          />

          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
