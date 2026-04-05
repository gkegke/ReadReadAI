import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from './App';
import { StudioPage } from '../features/studio/pages/StudioPage';
import { DashboardPage } from '../features/library/pages/DashboardPage';
import { MainLayout } from '../shared/components/layouts/MainLayout'; // Updated Import

const rootRoute = createRootRoute({
  component: App,
});

export const mainLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'main',
  component: MainLayout,
});

export const indexRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/',
  component: DashboardPage, // Dashboard now renders inside the MainLayout shell
});

export const projectRoute = createRoute({
  getParentRoute: () => mainLayoutRoute,
  path: '/project/$projectId',
  component: StudioPage,
});

const routeTree = rootRoute.addChildren([
  mainLayoutRoute.addChildren([indexRoute, projectRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
