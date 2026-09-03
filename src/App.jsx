import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import './App.css';

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import PhotographerWebsite from "./pages/public/PhotographerWebsite";

import AppLayout from "./layouts/AppLayout";

import PhotographerDashboard from "./pages/photographer/Dashboard";
import PhotographerBookings from "./pages/photographer/Bookings";
import BookingDetails from "./pages/photographer/BookingDetails";
import NewBooking from "./pages/photographer/NewBooking";
import PhotographerCalendar from "./pages/photographer/Calendar";
import PhotographerClients from "./pages/photographer/Clients";
import PhotographerEditClient from "./pages/photographer/EditClient";
import PhotographerClientProfile from "./pages/photographer/PhotographerClientProfile";
import PhotographerServices from "./pages/photographer/Services";
import PhotographerNewService from "./pages/photographer/NewService";
import PhotographerEditService from "./pages/photographer/EditService";
import PhotographerInvoices from "./pages/photographer/Invoices";
import PhotographerGalleries from "./pages/photographer/Galleries";
import PhotographerPortfolio from "./pages/photographer/Portfolio";
import PhotographerWebsiteBuilder from "./pages/photographer/WebsiteBuilder";
import PhotographerSettings from "./pages/photographer/Settings";


import ClientDashboard from "./pages/client/Dashboard";
import ClientBookings from "./pages/client/Bookings";
import ClientInvoices from "./pages/client/Invoices";
import ClientGalleries from "./pages/client/Galleries";
import ClientMessages from "./pages/client/Messages";
import ClientReviews from "./pages/client/Reviews";
import ClientProfile from "./pages/client/Profile";

import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

export default function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/:photographerSlug"
          element={<PhotographerWebsite />}
        />


        {/* =========================
            AUTHENTICATED APPLICATION
        ========================== */}

        <Route element={<ProtectedRoute />}>


          {/* =========================
              PHOTOGRAPHER PORTAL
          ========================== */}

          <Route
            element={
              <RoleRoute allowedRole="photographer" />
            }
          >

            <Route
              path="/photographer"
              element={<AppLayout />}
            >

              <Route
                index
                element={<PhotographerDashboard />}
              />

              <Route
                path="bookings"
                element={<PhotographerBookings />}
              />

              <Route
                path="/photographer/bookings/:bookingId"
                element={<BookingDetails />} />

              <Route
                path="/photographer/bookings/new"
                element={<NewBooking />}
              />

              <Route
                path="calendar"
                element={<PhotographerCalendar />}
              />

              <Route
                path="clients"
                element={<PhotographerClients />}
              />

              <Route
                path="/photographer/clients/:client_id/edit"
                element={<PhotographerEditClient />}
              />

              <Route
                path="/photographer/clients/:client_id"
                element={<PhotographerClientProfile />}
              />

              <Route
                path="services"
                element={<PhotographerServices />}
              />

              <Route
                path="/photographer/services/new"
                element={<PhotographerNewService />}
              />

              <Route
                path="/photographer/services/:service_id/edit"
                element={<PhotographerEditService />}
              />

              <Route
                path="invoices"
                element={<PhotographerInvoices />}
              />

              <Route
                path="galleries"
                element={<PhotographerGalleries />}
              />

              <Route
                path="portfolio"
                element={<PhotographerPortfolio />}
              />

              <Route
                path="website"
                element={<PhotographerWebsiteBuilder />}
              />

              <Route
                path="settings"
                element={<PhotographerSettings />}
              />

            </Route>

          </Route>


          {/* =========================
              CLIENT PORTAL
          ========================== */}

          <Route
            element={
              <RoleRoute allowedRole="client" />
            }
          >

            <Route
              path="/client"
              element={<AppLayout />}
            >

              <Route
                index
                element={<ClientDashboard />}
              />

              <Route
                path="bookings"
                element={<ClientBookings />}
              />

              <Route
                path="invoices"
                element={<ClientInvoices />}
              />

              <Route
                path="galleries"
                element={<ClientGalleries />}
              />

              <Route
                path="messages"
                element={<ClientMessages />}
              />

              <Route
                path="reviews"
                element={<ClientReviews />}
              />

              <Route
                path="profile"
                element={<ClientProfile />}
              />

            </Route>

          </Route>

        </Route>

      </Routes>

    </BrowserRouter>
  );
}