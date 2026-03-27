import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Wrapper around the Midtrans Snap API.
 * Uses `midtrans-client` npm package.
 */
@Injectable()
export class MidtransService {
    private readonly logger = new Logger(MidtransService.name);
    private snap: any;
    private coreApi: any;

    constructor(private readonly config: ConfigService) {
        const serverKey = this.config.get<string>('midtrans.serverKey', '');
        const clientKey = this.config.get<string>('midtrans.clientKey', '');
        const isProduction = this.config.get<boolean>('midtrans.isProduction', false);

        if (serverKey) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const midtransClient = require('midtrans-client');

                this.snap = new midtransClient.Snap({
                    isProduction,
                    serverKey,
                    clientKey,
                });

                this.coreApi = new midtransClient.CoreApi({
                    isProduction,
                    serverKey,
                    clientKey,
                });

                this.logger.log(`Midtrans initialized (${isProduction ? 'PRODUCTION' : 'SANDBOX'})`);
            } catch (err: any) {
                this.logger.error(`Midtrans initialization failed: ${err.message}`);
            }
        } else {
            this.logger.warn('Midtrans not configured — MIDTRANS_SERVER_KEY missing');
        }
    }

    /**
     * Create a Snap transaction and get the token + redirect URL.
     */
    async createTransaction(params: {
        orderId: string;
        amount: number;
        customerName: string;
        customerEmail: string;
        itemName: string;
    }) {
        if (!this.snap) throw new Error('Midtrans not configured');

        const parameter = {
            transaction_details: {
                order_id: params.orderId,
                gross_amount: params.amount,
            },
            customer_details: {
                first_name: params.customerName,
                email: params.customerEmail,
            },
            item_details: [
                {
                    id: params.orderId,
                    price: params.amount,
                    quantity: 1,
                    name: params.itemName,
                },
            ],
        };

        const transaction = await this.snap.createTransaction(parameter);
        this.logger.log(`Snap token created for order ${params.orderId}`);

        return {
            token: transaction.token,
            redirectUrl: transaction.redirect_url,
        };
    }

    /**
     * Verify a webhook notification from Midtrans.
     */
    async verifyNotification(body: any) {
        if (!this.coreApi) throw new Error('Midtrans not configured');
        return this.coreApi.transaction.notification(body);
    }

    /**
     * Get transaction status from Midtrans.
     */
    async getStatus(orderId: string) {
        if (!this.coreApi) throw new Error('Midtrans not configured');
        return this.coreApi.transaction.status(orderId);
    }

    get isConfigured(): boolean {
        return !!this.snap;
    }

    get clientKey(): string {
        return this.config.get<string>('midtrans.clientKey', '');
    }
}
