// SMS integration via Zapier webhook for OpenPhone
// Configure ZAPIER_WEBHOOK_URL environment variable
import { storage } from './storage';

interface QuoteSmsData {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  serviceName: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

function replaceMacros(template: string, data: QuoteSmsData): string {
  return template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, data.serviceName)
    .replace(/\{price\}/g, data.price)
    .replace(/\{repairTime\}/g, data.repairTime || '')
    .replace(/\{warranty\}/g, data.warranty || '');
}

const defaultSmsTemplate = "Hi {customerName}! Your RepairQuote: {serviceName} for {deviceName} - ${price} plus taxes. {repairTime}. {warranty}. Reply for questions!";

export async function sendQuoteSms(data: QuoteSmsData): Promise<boolean> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('ZAPIER_WEBHOOK_URL not configured - SMS not sent');
    return false;
  }

  if (!data.customerPhone) {
    console.log('No phone number provided - SMS not sent');
    return false;
  }

  try {
    // Fetch custom template from database
    const smsTemplate = await storage.getMessageTemplate('sms');
    const message = replaceMacros(smsTemplate?.content || defaultSmsTemplate, data);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: data.customerPhone,
        message: message,
        customerName: data.customerName,
        deviceName: data.deviceName,
        serviceName: data.serviceName,
        price: data.price,
        repairTime: data.repairTime || '',
        warranty: data.warranty || ''
      })
    });

    if (response.ok) {
      console.log(`Quote SMS webhook triggered for ${data.customerPhone}`);
      return true;
    } else {
      console.error('Zapier webhook failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Failed to trigger SMS webhook:', error);
    return false;
  }
}

// Combined multi-service quote SMS
interface CombinedQuoteSmsData {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  services: Array<{
    serviceName: string;
    price: string;
  }>;
  grandTotal: string;
}

export async function sendCombinedQuoteSms(data: CombinedQuoteSmsData): Promise<boolean> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('ZAPIER_WEBHOOK_URL not configured - SMS not sent');
    return false;
  }

  if (!data.customerPhone) {
    console.log('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const serviceNames = data.services.map(s => s.serviceName).join(', ');
    const message = `Hi ${data.customerName}! Your RepairQuote for ${data.deviceName}: ${serviceNames}. Total: $${data.grandTotal} plus taxes. Reply for questions!`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: data.customerPhone,
        message: message,
        customerName: data.customerName,
        deviceName: data.deviceName,
        serviceName: serviceNames,
        price: data.grandTotal,
        repairTime: '',
        warranty: ''
      })
    });

    if (response.ok) {
      console.log(`Combined quote SMS webhook triggered for ${data.customerPhone}`);
      return true;
    } else {
      console.error('Zapier webhook failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Failed to trigger combined SMS webhook:', error);
    return false;
  }
}
