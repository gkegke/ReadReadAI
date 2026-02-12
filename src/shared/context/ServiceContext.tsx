/**
 * CRITICAL: Service Discovery & Dependency Injection Container.
 * This replaces raw singleton exports to allow for better testability,
 * lifecycle management, and cleaner architectural boundaries.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { ttsService } from '../../features/tts/services/TTSService';
import { audioPlaybackService } from '../../features/studio/services/AudioPlaybackService';
import { g2pService } from '../../features/tts/services/G2PService';
import { jobQueueManager } from '../../features/tts/services/JobQueueManager';
import { logger } from '../services/Logger';
import { storage } from '../services/storage';

interface Services {
    tts: typeof ttsService;
    playback: typeof audioPlaybackService;
    g2p: typeof g2pService;
    queue: typeof jobQueueManager;
    logger: typeof logger;
    storage: typeof storage;
}

const ServiceContext = createContext<Services | null>(null);

export const ServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Services are memoized to ensure stability across re-renders.
    const services = useMemo(() => ({
        tts: ttsService,
        playback: audioPlaybackService,
        g2p: g2pService,
        queue: jobQueueManager,
        logger: logger,
        storage: storage
    }), []);

    return (
        <ServiceContext.Provider value={services}>
            {children}
        </ServiceContext.Provider>
    );
};

export const useServices = () => {
    const context = useContext(ServiceContext);
    if (!context) {
        throw new Error("useServices must be used within a ServiceProvider");
    }
    return context;
};