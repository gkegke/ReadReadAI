import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import App from './App';
import { StudioPage } from '../features/studio/pages/StudioPage';
import { DashboardPage } from '../features/library/pages/DashboardPage';

const rootRoute = createRootRoute({
  component: () => (
    <App>
      <Outlet />
    </App>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$projectId',
  component: StudioPage,
});

const routeTree = rootRoute.addChildren([indexRoute, projectRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}