import { db } from '../db';
import type { LogSeverity } from '../types/schema';

/**
 * Structured Logger Service
 * Persists logs to IndexedDB for "Zero-Cloud" observability.
 */
class LoggerService {
    private readonly MAX_LOGS = 2000;

    async log(severity: LogSeverity, component: string, message: string, context?: any) {
        const entry = {
            timestamp: new Date(),
            severity,
            component,
            message,
            context: context ? JSON.parse(JSON.stringify(context)) : undefined
        };

        // Output to console for DX
        const color = severity === 'ERROR' ? 'color: #ff4d4d' : severity === 'WARN' ? 'color: #ffaa00' : 'color: #00ccff';
        console.log(`%c[${severity}] [${component}]`, color, message, context || '');

        try {
            // Persist to DB
            await db.logs.add(entry);

            // Simple Rotation (Run occasionally)
            if (Math.random() < 0.02) {
                this.rotate();
            }
        } catch (e) {
            console.error("Logger failed to write to DB", e);
        }
    }

    info(component: string, message: string, context?: any) { return this.log('INFO', component, message, context); }
    warn(component: string, message: string, context?: any) { return this.log('WARN', component, message, context); }
    error(component: string, message: string, context?: any) { return this.log('ERROR', component, message, context); }
    debug(component: string, message: string, context?: any) { return this.log('DEBUG', component, message, context); }

    private async rotate() {
        const count = await db.logs.count();
        if (count > this.MAX_LOGS) {
            const toDelete = count - this.MAX_LOGS;
            const oldest = await db.logs.orderBy('timestamp').limit(toDelete).primaryKeys();
            await db.logs.bulkDelete(oldest);
        }
    }

    async exportLogs() {
        const allLogs = await db.logs.orderBy('timestamp').reverse().toArray();
        const blob = new Blob([JSON.stringify(allLogs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readread_logs_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export const logger = new LoggerService();