// SMS integration via OpenPhone/Quo API
// Configure OPENPHONE_API_KEY environment variable
import { storage } from './storage';

const OPENPHONE_API_BASE = 'https://api.openphone.com/v1';

interface QuoteSmsData {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  serviceName: string;
  serviceDescription?: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

interface CombinedQuoteSmsData {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  services: Array<{
    serviceName: string;
    serviceDescription?: string;
    price: string;
    repairTime?: string;
    warranty?: string;
  }>;
  grandTotal: string;
  multiServiceDiscount?: string;
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

function cleanupSingleServicePlaceholders(text: string): string {
  return text
    .replace(/\{[a-zA-Z]+\}/g, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function replaceMacros(template: string, data: QuoteSmsData): string {
  const result = template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, data.serviceName)
    .replace(/\{serviceDescription\}/g, data.serviceDescription || '')
    .replace(/\{price\}/g, data.price)
    .replace(/\{repairTime\}/g, data.repairTime || '')
    .replace(/\{warranty\}/g, data.warranty || '');
  
  return cleanupSingleServicePlaceholders(result);
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
    console.log('OPENPHONE_API_KEY not configured - SMS not sent');
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
      console.log(`SMS sent via OpenPhone to ${formattedTo}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error('OpenPhone API error:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('Failed to send SMS via OpenPhone:', error);
    return false;
  }
}

const defaultSmsTemplate = "Hi {customerName}! Your RepairQuote: {serviceName} for {deviceName} - ${price} plus taxes. {repairTime}. {warranty}. Reply for questions!";

export async function sendQuoteSms(data: QuoteSmsData): Promise<boolean> {
  if (!data.customerPhone) {
    console.log('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const smsTemplate = await storage.getMessageTemplate('sms');
    const message = replaceMacros(smsTemplate?.content || defaultSmsTemplate, data);
    return await sendSmsViaOpenPhone(data.customerPhone, message);
  } catch (error) {
    console.error('Failed to send quote SMS:', error);
    return false;
  }
}

const defaultCombinedSmsTemplate = "Hi {customerName}! Your RepairQuote for {deviceName}: {servicesList}. Total: ${price} plus taxes. Reply for questions!";

const defaultSmsServiceItemTemplate = "{serviceName} (${servicePrice})";

function buildSmsServicesList(services: CombinedQuoteSmsData['services'], serviceItemTemplate: string): string {
  return services.map(s => {
    return serviceItemTemplate
      .replace(/\{serviceName\}/g, s.serviceName)
      .replace(/\{servicePrice\}/g, s.price)
      .replace(/\{repairTime\}/g, s.repairTime || '')
      .replace(/\{warranty\}/g, s.warranty || '')
      .replace(/\{serviceDescription\}/g, s.serviceDescription || '');
  }).join('\n\n');
}

function cleanupEmptyPlaceholders(text: string): string {
  return text
    .replace(/\{[a-zA-Z]+\}/g, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function replaceCombinedMacros(template: string, data: CombinedQuoteSmsData): Promise<string> {
  const serviceNames = data.services.map(s => s.serviceName).join(', ');
  const serviceDescriptions = data.services.map(s => s.serviceDescription).filter(Boolean).join('; ');
  const repairTimes = data.services.map(s => s.repairTime).filter(Boolean).join(', ');
  const warranties = data.services.map(s => s.warranty).filter(Boolean).join(', ');
  
  const serviceItemTemplate = await storage.getMessageTemplate('sms_service_item_template');
  const servicesList = buildSmsServicesList(data.services, serviceItemTemplate?.content || defaultSmsServiceItemTemplate);
  
  const result = template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, serviceNames)
    .replace(/\{serviceDescription\}/g, serviceDescriptions)
    .replace(/\{price\}/g, data.grandTotal)
    .replace(/\{repairTime\}/g, repairTimes)
    .replace(/\{warranty\}/g, warranties)
    .replace(/\{servicesList\}/g, servicesList)
    .replace(/\{multiServiceDiscount\}/g, data.multiServiceDiscount ? `Multi-Service Discount: $${data.multiServiceDiscount}` : '');
  
  return cleanupEmptyPlaceholders(result);
}

export async function sendCombinedQuoteSms(data: CombinedQuoteSmsData): Promise<boolean> {
  if (!data.customerPhone) {
    console.log('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const smsTemplate = await storage.getMessageTemplate('sms');
    const message = await replaceCombinedMacros(smsTemplate?.content || defaultCombinedSmsTemplate, data);
    return await sendSmsViaOpenPhone(data.customerPhone, message);
  } catch (error) {
    console.error('Failed to send combined quote SMS:', error);
    return false;
  }
}

export async function sendUnknownDeviceQuoteSms(data: UnknownDeviceSmsData): Promise<boolean> {
  if (!data.customerPhone) {
    console.log('No phone number provided - SMS not sent');
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
    console.error('Failed to send unknown device SMS:', error);
    return false;
  }
}

// Test SMS function - sends a test SMS with sample data
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

  console.log(`Sending test SMS to ${recipientPhone}...`);
  return await sendCombinedQuoteSms(testData);
}
