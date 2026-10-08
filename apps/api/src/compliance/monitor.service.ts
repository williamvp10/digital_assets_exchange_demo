import { Injectable } from '@nestjs/common';
export type Risk = 'LOW' | 'MEDIUM' | 'HIGH';
/** Adaptador HTTP: los servicios de dominio no conocen Express ni el archivo JSON del mock. */
@Injectable()
export class Monitor {
  /** Un timeout, error HTTP o contrato inesperado debe impedir la ejecución monetaria. */
  async screen(amount: string): Promise<Risk> {
    const response = await fetch(
      `${process.env.COMPLIANCE_URL || 'http://localhost:3101'}/screen`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new Error('Monitoring unavailable');
    const body = (await response.json()) as { risk: Risk };
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(body.risk))
      throw new Error('Invalid monitoring response');
    return body.risk;
  }
}
