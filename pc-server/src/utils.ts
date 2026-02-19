import { networkInterfaces } from 'os';
import { createServer } from 'net';

export function getLocalIPAddress(): string {
    try {
        const interfaces = networkInterfaces();
        if (!interfaces) {
            return '127.0.0.1';
        }
        
        for (const name of Object.keys(interfaces)) {
            const nets = interfaces[name];
            if (!nets) continue;
            
            for (const net of nets) {
                // IPv4이고 내부 IP가 아닌 경우
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
    } catch (error) {
        // 시스템 에러 발생 시 localhost 반환
        return '127.0.0.1';
    }
    
    // 내부 IP를 찾지 못한 경우 localhost 반환
    return '127.0.0.1';
}

export function isPortAvailable(port: number, host: string = '0.0.0.0'): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();

        server.once('error', () => {
            resolve(false);
        });

        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, host);
    });
}
