import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from './App';
import { StudioPage } from '../features/studio/pages/StudioPage';
import { DashboardPage } from '../features/library/pages/DashboardPage';
import { DashboardLayout } from '../shared/components/layouts/DashboardLayout';
import { StudioLayout } from '../shared/components/layouts/StudioLayout';

const rootRoute = createRootRoute({
  component: App,
});

// [STABILITY] Explicitly exported for use in useParams/useNavigate
export const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  component: DashboardLayout,
});

export const studioLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'studio',
  component: StudioLayout,
});

export const indexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/',
  component: DashboardPage,
});

export const projectRoute = createRoute({
  getParentRoute: () => studioLayoutRoute,
  path: '/project/$projectId',
  component: StudioPage,
});

const routeTree = rootRoute.addChildren([
  dashboardLayoutRoute.addChildren([indexRoute]),
  studioLayoutRoute.addChildren([projectRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}