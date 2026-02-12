import { db } from '../db';
import type { LogSeverity } from '../types/schema';
import { useSystemStore } from '../store/useSystemStore';

/**
 * Enhanced Logger Service (Phase 3: Observability)
 * Now collects system telemetry and generates comprehensive debug bundles.
 */
class LoggerService {
    private readonly MAX_LOGS = 5000;

    async log(severity: LogSeverity, component: string, message: string, context?: any) {
        const entry = {
            timestamp: new Date(),
            severity,
            component,
            message,
            context: context ? JSON.parse(JSON.stringify(context)) : undefined
        };

        if (severity === 'ERROR') {
            console.error(`%c[${severity}] [${component}]`, 'color: #ff4d4d; font-weight: bold;', message, context || '');
        } else if (severity === 'WARN') {
            console.warn(`%c[${severity}] [${component}]`, 'color: #ffa500;', message, context || '');
        } else {
            console.log(`%c[${severity}] [${component}]`, 'color: #00ccff;', message, context || '');
        }

        try {
            await db.logs.add(entry);
            if (Math.random() < 0.01) this.rotate();
        } catch (e) {
            console.error("Logger write failure", e);
        }
    }

    info(comp: string, msg: string, ctx?: any) { return this.log('INFO', comp, msg, ctx); }
    warn(comp: string, msg: string, ctx?: any) { return this.log('WARN', comp, msg, ctx); }
    error(comp: string, msg: string, ctx?: any) { return this.log('ERROR', comp, msg, ctx); }
    debug(comp: string, msg: string, ctx?: any) { return this.log('DEBUG', comp, msg, ctx); }

    private async rotate() {
        const count = await db.logs.count();
        if (count > this.MAX_LOGS) {
            const oldest = await db.logs.orderBy('timestamp').limit(count - this.MAX_LOGS).primaryKeys();
            await db.logs.bulkDelete(oldest);
        }
    }

    /**
     * CRITICAL: Generates a "Technical Support Bundle"
     * Includes logs, system metadata, and database stats.
     */
    async exportDebugBundle() {
        this.info('System', 'Generating Debug Bundle...');
        
        const logs = await db.logs.orderBy('timestamp').toArray();
        const projectCount = await db.projects.count();
        const chunkCount = await db.chunks.count();
        const jobCount = await db.jobs.count();
        
        const telemetry = {
            appVersion: '0.8.0',
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            storageMode: useSystemStore.getState().storageMode,
            stats: { projects: projectCount, chunks: chunkCount, jobs: jobCount },
            memory: (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize / 1024 / 1024 + 'MB',
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize / 1024 / 1024 + 'MB',
            } : 'N/A'
        };

        const bundle = { telemetry, logs };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readread_debug_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export const logger = new LoggerService();