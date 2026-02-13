import { db } from '../db';
import type { LogSeverity, LogEntry } from '../types/schema';
import { useSystemStore } from '../store/useSystemStore';

/**
 * LoggerService (V4 - Structured & Observability Focused)
 * Captures system telemetry and provides a "Diagnostic Bundle" for Zero-Cloud support.
 */
class LoggerService {
    private readonly MAX_LOGS = 5000;

    /**
     * Standardized Structured Logging
     * @param context - Key-value pairs of metadata (no PII)
     */
    async log(severity: LogSeverity, component: string, message: string, context?: Record<string, any>) {
        const entry: Omit<LogEntry, 'id'> = {
            timestamp: new Date(),
            severity,
            component,
            message,
            context: context ? JSON.parse(JSON.stringify(context)) : undefined
        };

        // Dev Console Formatting
        const colors = { DEBUG: '#7f8c8d', INFO: '#2ecc71', WARN: '#f1c40f', ERROR: '#e74c3c' };
        console.log(
            `%c[${severity}] [${component}] %c${message}`,
            `color: ${colors[severity]}; font-weight: bold;`,
            `color: inherit;`,
            context || ''
        );

        try {
            await db.logs.add(entry as LogEntry);
            if (Math.random() < 0.05) this.rotate();
        } catch (e) {
            console.warn("[Logger] Persistence failed (DB locked?)", e);
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
     * Diagnostic Telemetry (Coarsened for Privacy)
     * Captures hardware cohorts and storage health.
     */
    async getDiagnosticBundle() {
        const [projects, chunks, jobs] = await Promise.all([
            db.projects.count(),
            db.chunks.count(),
            db.jobs.count()
        ]);

        return {
            version: '0.8.0',
            timestamp: new Date().toISOString(),
            system: {
                userAgent: navigator.userAgent,
                // Research Tag: navigator.deviceMemory is Chromium-only (0.25 to 8GB)
                ram_gb_approx: (navigator as any).deviceMemory || 'unknown',
                logical_cores: navigator.hardwareConcurrency || 'unknown',
                storage_mode: useSystemStore.getState().storageMode
            },
            database: {
                stats: { projects, chunks, jobs },
                is_persistent: await navigator.storage?.persisted() || false
            }
        };
    }

    async exportLogs() {
        const bundle = {
            telemetry: await this.getDiagnosticBundle(),
            logs: await db.logs.orderBy('timestamp').reverse().limit(1000).toArray()
        };
        
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