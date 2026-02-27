import { storage } from './storage';
import { replaceMacros, replaceCombinedMacros } from './template-utils';
import type { QuoteData, CombinedQuoteData } from './template-utils';
import { logger } from './logger';

const OPENPHONE_API_BASE = 'https://api.openphone.com/v1';

interface QuoteSmsData extends QuoteData {
  customerPhone: string;
}

interface CombinedQuoteSmsData extends CombinedQuoteData {
  customerPhone: string;
}

interface UnknownDeviceSmsData {
  customerName: string;
  customerPhone: string;
  deviceDescription: string;
  issueDescription: string;
}

interface OpenPhoneNumber {
  id: string;
  phoneNumber: string;
  name?: string;
  userId?: string;
}

function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return `+${digits}`;
}

const OPENPHONE_FROM_NUMBER = process.env.OPENPHONE_FROM_NUMBER || '+12264449927';

function getFromPhoneNumber(): string {
  return OPENPHONE_FROM_NUMBER;
}

async function sendSmsViaOpenPhone(to: string, message: string): Promise<boolean> {
  const apiKey = process.env.OPENPHONE_API_KEY;
  
  if (!apiKey) {
    logger.info('OPENPHONE_API_KEY not configured - SMS not sent');
    return false;
  }
  
  const fromNumber = getFromPhoneNumber();
  
  const formattedTo = formatPhoneE164(to);
  
  try {
    const response = await fetch(`${OPENPHONE_API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message,
        from: fromNumber,
        to: [formattedTo]
      })
    });
    
    if (response.ok || response.status === 202) {
      logger.info('SMS sent via OpenPhone', { to: formattedTo });
      return true;
    } else {
      const errorText = await response.text();
      logger.error('OpenPhone API error', { status: response.status, error: errorText });
      return false;
    }
  } catch (error) {
    logger.error('Failed to send SMS via OpenPhone', { error: String(error) });
    return false;
  }
}

const defaultSmsTemplate = "Hi {customerName}! Your RepairQuote: {serviceName} for {deviceName} - ${price} plus taxes. {repairTime}. {warranty}. Reply for questions!";

export async function sendQuoteSms(data: QuoteSmsData): Promise<boolean> {
  if (!data.customerPhone) {
    logger.info('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const smsTemplate = await storage.getMessageTemplate('sms');
    const message = replaceMacros(smsTemplate?.content || defaultSmsTemplate, data, 'sms');
    return await sendSmsViaOpenPhone(data.customerPhone, message);
  } catch (error) {
    logger.error('Failed to send quote SMS', { error: String(error) });
    return false;
  }
}

const defaultCombinedSmsTemplate = "Hi {customerName}! Your RepairQuote for {deviceName}: {servicesList}. Total: ${price} plus taxes. Reply for questions!";
const defaultSmsServiceItemTemplate = "{serviceName} (${servicePrice})";

export async function sendCombinedQuoteSms(data: CombinedQuoteSmsData): Promise<boolean> {
  if (!data.customerPhone) {
    logger.info('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const smsTemplate = await storage.getMessageTemplate('sms');
    const message = await replaceCombinedMacros(smsTemplate?.content || defaultCombinedSmsTemplate, data, 'sms_service_item_template', defaultSmsServiceItemTemplate, 'sms');
    return await sendSmsViaOpenPhone(data.customerPhone, message);
  } catch (error) {
    logger.error('Failed to send combined quote SMS', { error: String(error) });
    return false;
  }
}

export async function sendUnknownDeviceQuoteSms(data: UnknownDeviceSmsData): Promise<boolean> {
  if (!data.customerPhone) {
    logger.info('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const smsTemplate = await storage.getMessageTemplate('unknown_device_sms');
    const defaultMessage = `Hi ${data.customerName}! Thanks for contacting RepairQuote. We received your inquiry about "${data.deviceDescription}". Our team will review and contact you with a personalized quote soon!`;
    
    const message = smsTemplate?.content
      ?.replace(/\{customerName\}/g, data.customerName)
      ?.replace(/\{deviceDescription\}/g, data.deviceDescription)
      ?.replace(/\{issueDescription\}/g, data.issueDescription)
      || defaultMessage;

    return await sendSmsViaOpenPhone(data.customerPhone, message);
  } catch (error) {
    logger.error('Failed to send unknown device SMS', { error: String(error) });
    return false;
  }
}

export async function sendTestSms(recipientPhone: string): Promise<boolean> {
  const testData = {
    customerName: 'Test Customer',
    customerPhone: recipientPhone,
    deviceName: 'iPhone 15 Pro Max',
    services: [
      {
        serviceName: 'Screen Replacement',
        serviceDescription: 'Replace cracked or damaged screen',
        price: '$299.99',
        repairTime: '1-2 hours',
        warranty: '90 days'
      },
      {
        serviceName: 'Battery Replacement',
        serviceDescription: 'Replace worn battery',
        price: '$89.99',
        repairTime: '30 minutes',
        warranty: '60 days'
      }
    ],
    grandTotal: '$389.98'
  };

  logger.info('Sending test SMS', { to: recipientPhone });
  return await sendCombinedQuoteSms(testData);
}
