import { networkInterfaces } from 'os';

export function getLocalIPAddress(): string {
    const interfaces = networkInterfaces();
    
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
    
    // 내부 IP를 찾지 못한 경우 localhost 반환
    return '127.0.0.1';
}
