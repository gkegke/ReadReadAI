import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { ServiceProvider } from '../shared/context/ServiceContext' // NEW
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Wrap the app in the ServiceProvider to enable DI */}
    <ServiceProvider>
        <RouterProvider router={router} />
    </ServiceProvider>
  </StrictMode>,
)