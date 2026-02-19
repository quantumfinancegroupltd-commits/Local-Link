import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RequireAuth } from './auth/RequireAuth.jsx'
import { AppLayout } from './components/layout/AppLayout.jsx'
import { Card } from './components/ui/FormControls.jsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { Onboarding } from './pages/onboarding/Onboarding.jsx'
import { useAuth } from './auth/useAuth.js'

// Keep the initial bundle slim: lazy-load most routes.
const Home = lazy(() => import('./pages/Home.jsx').then((m) => ({ default: m.Home })))
const Login = lazy(() => import('./pages/auth/Login.jsx').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/auth/Register.jsx').then((m) => ({ default: m.Register })))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx').then((m) => ({ default: m.ResetPassword })))
const BuyerToday = lazy(() => import('./pages/buyer/BuyerToday.jsx').then((m) => ({ default: m.BuyerToday })))
const BuyerJobs = lazy(() => import('./pages/buyer/BuyerDashboard.jsx').then((m) => ({ default: m.BuyerJobs })))
const BuyerPostJob = lazy(() => import('./pages/buyer/BuyerPostJob.jsx').then((m) => ({ default: m.BuyerPostJob })))
const BuyerJobDetail = lazy(() => import('./pages/buyer/BuyerJobDetail.jsx').then((m) => ({ default: m.BuyerJobDetail })))
const BuyerProviders = lazy(() => import('./pages/buyer/BuyerProviders.jsx').then((m) => ({ default: m.BuyerProviders })))
const BuyerJobEscrow = lazy(() => import('./pages/buyer/BuyerJobEscrow.jsx').then((m) => ({ default: m.BuyerJobEscrow })))
const PaystackCallback = lazy(() => import('./pages/buyer/PaystackCallback.jsx').then((m) => ({ default: m.PaystackCallback })))
const BuyerOrders = lazy(() => import('./pages/buyer/BuyerOrders.jsx').then((m) => ({ default: m.BuyerOrders })))
const BuyerJobHistory = lazy(() => import('./pages/buyer/BuyerJobHistory.jsx').then((m) => ({ default: m.BuyerJobHistory })))

const ArtisanDashboard = lazy(() => import('./pages/artisan/ArtisanDashboard.jsx').then((m) => ({ default: m.ArtisanDashboard })))
const ArtisanJobDetail = lazy(() => import('./pages/artisan/ArtisanJobDetail.jsx').then((m) => ({ default: m.ArtisanJobDetail })))
const ArtisanJobEscrow = lazy(() => import('./pages/artisan/ArtisanJobEscrow.jsx').then((m) => ({ default: m.ArtisanJobEscrow })))
const ArtisanServices = lazy(() => import('./pages/artisan/ArtisanServices.jsx').then((m) => ({ default: m.ArtisanServices })))
const ArtisanAvailability = lazy(() => import('./pages/artisan/ArtisanAvailability.jsx').then((m) => ({ default: m.ArtisanAvailability })))
const ArtisanAnalytics = lazy(() => import('./pages/artisan/ArtisanAnalytics.jsx').then((m) => ({ default: m.ArtisanAnalytics })))

const FarmerDashboard = lazy(() => import('./pages/farmer/FarmerDashboard.jsx').then((m) => ({ default: m.FarmerDashboard })))
const FarmerListProduct = lazy(() => import('./pages/farmer/FarmerListProduct.jsx').then((m) => ({ default: m.FarmerListProduct })))
const FarmerEditProduct = lazy(() => import('./pages/farmer/FarmerEditProduct.jsx').then((m) => ({ default: m.FarmerEditProduct })))
const FarmerOrders = lazy(() => import('./pages/farmer/FarmerOrders.jsx').then((m) => ({ default: m.FarmerOrders })))
const FarmerAnalytics = lazy(() => import('./pages/farmer/FarmerAnalytics.jsx').then((m) => ({ default: m.FarmerAnalytics })))

const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard.jsx').then((m) => ({ default: m.DriverDashboard })))

const MessagesInbox = lazy(() => import('./pages/messages/Inbox.jsx').then((m) => ({ default: m.MessagesInbox })))
const MessagesThread = lazy(() => import('./pages/messages/Thread.jsx').then((m) => ({ default: m.MessagesThread })))
const Notifications = lazy(() => import('./pages/Notifications.jsx').then((m) => ({ default: m.Notifications })))
const Support = lazy(() => import('./pages/support/Support.jsx').then((m) => ({ default: m.Support })))

const MyReviews = lazy(() => import('./pages/reviews/MyReviews.jsx').then((m) => ({ default: m.MyReviews })))
const LeaveReview = lazy(() => import('./pages/reviews/LeaveReview.jsx').then((m) => ({ default: m.LeaveReview })))

const MyProfile = lazy(() => import('./pages/profile/MyProfile.jsx').then((m) => ({ default: m.MyProfile })))
const PublicProfile = lazy(() => import('./pages/profile/PublicProfile.jsx').then((m) => ({ default: m.PublicProfile })))

const MarketplaceBrowse = lazy(() => import('./pages/marketplace/MarketplaceBrowse.jsx').then((m) => ({ default: m.MarketplaceBrowse })))
const MarketplaceProductDetail = lazy(() =>
  import('./pages/marketplace/MarketplaceProductDetail.jsx').then((m) => ({ default: m.MarketplaceProductDetail })),
)

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx').then((m) => ({ default: m.AdminDashboard })))
const AdminGate = lazy(() => import('./pages/admin/AdminGate.jsx').then((m) => ({ default: m.AdminGate })))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx').then((m) => ({ default: m.AdminLogin })))
const AdminSetPassword = lazy(() => import('./pages/admin/AdminSetPassword.jsx').then((m) => ({ default: m.AdminSetPassword })))

const NotFound = lazy(() => import('./pages/NotFound.jsx').then((m) => ({ default: m.NotFound })))
const About = lazy(() => import('./pages/public/About.jsx').then((m) => ({ default: m.About })))
const Contact = lazy(() => import('./pages/public/Contact.jsx').then((m) => ({ default: m.Contact })))
const Careers = lazy(() => import('./pages/public/Careers.jsx').then((m) => ({ default: m.Careers })))
// /start now redirects to /onboarding (single source of truth)
const News = lazy(() => import('./pages/news/News.jsx').then((m) => ({ default: m.News })))
const NewsPost = lazy(() => import('./pages/news/NewsPost.jsx').then((m) => ({ default: m.NewsPost })))
const Feed = lazy(() => import('./pages/feed/Feed.jsx').then((m) => ({ default: m.Feed })))
const People = lazy(() => import('./pages/people/People.jsx').then((m) => ({ default: m.People })))
const OnboardingAdverts = lazy(() => import('./pages/onboarding/OnboardingAdverts.jsx').then((m) => ({ default: m.OnboardingAdverts })))
const IdVerification = lazy(() => import('./pages/verification/IdVerification.jsx').then((m) => ({ default: m.IdVerification })))
const CorporateLanding = lazy(() => import('./pages/corporate/CorporateLanding.jsx').then((m) => ({ default: m.CorporateLanding })))
const JobsBoard = lazy(() => import('./pages/corporate/JobsBoard.jsx').then((m) => ({ default: m.JobsBoard })))
const JobDetail = lazy(() => import('./pages/corporate/JobDetail.jsx').then((m) => ({ default: m.JobDetail })))
const CompanyPublic = lazy(() => import('./pages/corporate/CompanyPublic.jsx').then((m) => ({ default: m.CompanyPublic })))
const CompanyDashboard = lazy(() => import('./pages/corporate/CompanyDashboard.jsx').then((m) => ({ default: m.CompanyDashboard })))
const CompanyInviteAccept = lazy(() => import('./pages/corporate/CompanyInviteAccept.jsx').then((m) => ({ default: m.CompanyInviteAccept })))
const MyCompanyPublicRedirect = lazy(() =>
  import('./pages/corporate/MyCompanyPublicRedirect.jsx').then((m) => ({ default: m.MyCompanyPublicRedirect })),
)
const MyShifts = lazy(() => import('./pages/work/MyShifts.jsx').then((m) => ({ default: m.MyShifts })))

const TrustEscrow = lazy(() => import('./pages/trust/Escrow.jsx').then((m) => ({ default: m.TrustEscrow })))
const TrustVerification = lazy(() => import('./pages/trust/Verification.jsx').then((m) => ({ default: m.TrustVerification })))
const TrustReviews = lazy(() => import('./pages/trust/Reviews.jsx').then((m) => ({ default: m.TrustReviews })))

function RouteLoading() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <Card>Loading…</Card>
    </div>
  )
}

function ProfileRoute() {
  const { user } = useAuth()
  // For companies, "profile" should mean the public company page (LinkedIn-style),
  // not the internal dashboard.
  if (user?.role === 'company') return <Navigate to="/company/public" replace />
  return <MyProfile />
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/start" element={<Navigate to="/onboarding" replace />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/adverts" element={<OnboardingAdverts />} />
            <Route path="/corporate" element={<CorporateLanding />} />
            <Route path="/jobs" element={<JobsBoard />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/c/:slug" element={<CompanyPublic />} />
            <Route
              path="/company/invite"
              element={
                <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                  <CompanyInviteAccept />
                </RequireAuth>
              }
            />
            <Route
              path="/company"
              element={
                <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                  <CompanyDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/company/public"
              element={
                <RequireAuth roles={['company']}>
                  <MyCompanyPublicRedirect />
                </RequireAuth>
              }
            />
            <Route
              path="/shifts"
              element={
                <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver']}>
                  <MyShifts />
                </RequireAuth>
              }
            />
            <Route
              path="/verify"
              element={
                <RequireAuth roles={['artisan', 'farmer', 'driver']}>
                  <IdVerification />
                </RequireAuth>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:slug" element={<NewsPost />} />
            <Route
              path="/feed"
              element={
                <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                  <Feed />
                </RequireAuth>
              }
            />
            <Route
              path="/people"
              element={
                <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                  <People />
                </RequireAuth>
              }
            />
            <Route path="/trust/escrow" element={<TrustEscrow />} />
            <Route path="/trust/verification" element={<TrustVerification />} />
            <Route path="/trust/reviews" element={<TrustReviews />} />
            <Route path="/providers" element={<BuyerProviders />} />

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
            path="/buyer/orders"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerOrders />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/history"
            element={
              <RequireAuth roles={['buyer']}>
                <BuyerJobHistory />
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
            path="/buyer/payments/paystack"
            element={
              <RequireAuth roles={['buyer']}>
                <PaystackCallback />
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
            path="/artisan/jobs/:id/escrow"
            element={
              <RequireAuth roles={['artisan']}>
                <ArtisanJobEscrow />
              </RequireAuth>
            }
          />
          <Route
            path="/artisan/services"
            element={
              <RequireAuth roles={['artisan']}>
                <ArtisanServices />
              </RequireAuth>
            }
          />
          <Route
            path="/artisan/availability"
            element={
              <RequireAuth roles={['artisan']}>
                <ArtisanAvailability />
              </RequireAuth>
            }
          />
          <Route
            path="/artisan/analytics"
            element={
              <RequireAuth roles={['artisan']}>
                <ArtisanAnalytics />
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
            path="/farmer/orders"
            element={
              <RequireAuth roles={['farmer']}>
                <FarmerOrders />
              </RequireAuth>
            }
          />
          <Route
            path="/farmer/analytics"
            element={
              <RequireAuth roles={['farmer']}>
                <FarmerAnalytics />
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
            path="/farmer/products/:id/edit"
            element={
              <RequireAuth roles={['farmer']}>
                <FarmerEditProduct />
              </RequireAuth>
            }
          />

          <Route
            path="/driver"
            element={
              <RequireAuth roles={['driver']}>
                <DriverDashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/messages"
            element={
              <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                <MessagesInbox />
              </RequireAuth>
            }
          />
          <Route
            path="/messages/:type/:id"
            element={
              <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                <MessagesThread />
              </RequireAuth>
            }
          />

          <Route
            path="/notifications"
            element={
              <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                <Notifications />
              </RequireAuth>
            }
          />

          <Route
            path="/support"
            element={
              <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'admin']}>
                <Support />
              </RequireAuth>
            }
          />

          <Route
            path="/reviews"
            element={
              <RequireAuth roles={['artisan', 'farmer', 'driver']}>
                <MyReviews />
              </RequireAuth>
            }
          />
          <Route
            path="/reviews/leave"
            element={
              <RequireAuth roles={['buyer']}>
                <LeaveReview />
              </RequireAuth>
            }
          />

          <Route
            path="/profile"
            element={
              <RequireAuth roles={['buyer', 'artisan', 'farmer', 'driver', 'company', 'admin']}>
                <ProfileRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/u/:id"
            element={<PublicProfile />}
          />

          <Route
            path="/marketplace"
            element={<MarketplaceBrowse />}
          />
          <Route
            path="/marketplace/products/:id"
            element={<MarketplaceProductDetail />}
          />

          <Route
            path="/admin"
            element={
              <RequireAuth roles={['admin']} redirectTo="/admin/login">
                <AdminGate>
                  <AdminDashboard />
                </AdminGate>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/set-password"
            element={
              <RequireAuth roles={['admin']} redirectTo="/admin/login">
                <AdminSetPassword />
              </RequireAuth>
            }
          />

                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
