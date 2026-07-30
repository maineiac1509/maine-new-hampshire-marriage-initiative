import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import MarriageChampions from '@/pages/MarriageChampions';
import ChampionProfile from '@/pages/ChampionProfile';
import Assignments from '@/pages/Assignments';
import AssignmentDetail from '@/pages/AssignmentDetail';
import ContactHistory from '@/pages/ContactHistory';
import Reports from '@/pages/Reports';
import Administration from '@/pages/Administration';
import VolunteerTeams from '@/pages/VolunteerTeams';
import VolunteerTeamProfile from '@/pages/VolunteerTeamProfile';
import Users from '@/pages/Users';
import UserDetail from '@/pages/UserDetail';
import AdminRoute from '@/components/AdminRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Recommendations from '@/pages/Recommendations';
import MinistryIntelligence from '@/pages/MinistryIntelligence';
import MinistrySignalHistory from '@/pages/MinistrySignalHistory';
import StewardshipGuides from '@/pages/StewardshipGuides';
import StewardshipGuideDetail from '@/pages/StewardshipGuideDetail';
import StewardshipGuideAdmin from '@/pages/StewardshipGuideAdmin';
import CommunicationCenter from '@/pages/CommunicationCenter';
import CommunicationComposer from '@/pages/CommunicationComposer';
import CommunicationAdmin from '@/pages/CommunicationAdmin';
import ResourceLibrary from '@/pages/ResourceLibrary';
import ResourceDetail from '@/pages/ResourceDetail';
import ResourceAdmin from '@/pages/ResourceAdmin';
import MinistryCoachAdmin from '@/pages/MinistryCoachAdmin';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/champions" element={<MarriageChampions />} />
          <Route path="/champions/:id" element={<ChampionProfile />} />
          <Route path="/contact-history" element={<ContactHistory />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/intelligence" element={<MinistryIntelligence />} />
          <Route path="/intelligence/history" element={<MinistrySignalHistory />} />
          <Route path="/stewardship-guides" element={<StewardshipGuides />} />
          <Route path="/stewardship-guides/:id" element={<StewardshipGuideDetail />} />
          <Route path="/communication" element={<CommunicationCenter />} />
          <Route path="/communication/compose" element={<CommunicationComposer />} />
          <Route path="/resources" element={<ResourceLibrary />} />
          <Route path="/resources/:id" element={<ResourceDetail />} />
          <Route path="/volunteer-teams" element={<VolunteerTeams />} />
          <Route path="/volunteer-teams/:id" element={<VolunteerTeamProfile />} />
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/administration" element={<Administration />} />
            <Route path="/administration/ministry-coach" element={<MinistryCoachAdmin />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/assignments/:id" element={<AssignmentDetail />} />
            <Route path="/stewardship-guides/admin" element={<StewardshipGuideAdmin />} />
            <Route path="/communication/admin" element={<CommunicationAdmin />} />
            <Route path="/resources/admin" element={<ResourceAdmin />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App