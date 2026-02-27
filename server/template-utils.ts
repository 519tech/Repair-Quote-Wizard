import { storage } from './storage';

export interface ServiceData {
  serviceName: string;
  serviceDescription?: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

export interface QuoteData {
  customerName: string;
  deviceName: string;
  serviceName: string;
  serviceDescription?: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

export interface CombinedQuoteData {
  customerName: string;
  deviceName: string;
  services: ServiceData[];
  grandTotal: string;
  multiServiceDiscount?: string;
}

export function cleanupPlaceholders(text: string, mode: 'email' | 'sms' = 'email'): string {
  let result = text.replace(/\{[a-zA-Z]+\}/g, '');

  if (mode === 'sms') {
    result = result
      .replace(/[^\S\n]{2,}/g, ' ')
      .replace(/\.\s*\./g, '.');
  } else {
    result = result.replace(/^\s*[\r\n]/gm, '\n');
  }

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function replaceMacros(template: string, data: QuoteData, mode: 'email' | 'sms' = 'email'): string {
  const result = template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, data.serviceName)
    .replace(/\{serviceDescription\}/g, data.serviceDescription || '')
    .replace(/\{price\}/g, data.price)
    .replace(/\{repairTime\}/g, mode === 'email' && data.repairTime ? `Repair Time: ${data.repairTime}` : (data.repairTime || ''))
    .replace(/\{warranty\}/g, mode === 'email' && data.warranty ? `Warranty: ${data.warranty}` : (data.warranty || ''));

  return cleanupPlaceholders(result, mode);
}

export function buildServicesList(services: ServiceData[], serviceItemTemplate: string): string {
  return services.map(s => {
    return serviceItemTemplate
      .replace(/\{serviceName\}/g, s.serviceName)
      .replace(/\{servicePrice\}/g, s.price)
      .replace(/\{repairTime\}/g, s.repairTime || '')
      .replace(/\{warranty\}/g, s.warranty || '')
      .replace(/\{serviceDescription\}/g, s.serviceDescription || '');
  }).join('\n\n');
}

export async function replaceCombinedMacros(
  template: string,
  data: CombinedQuoteData,
  serviceItemTemplateKey: string,
  defaultServiceItemTemplate: string,
  mode: 'email' | 'sms' = 'email'
): Promise<string> {
  const serviceNames = data.services.map(s => s.serviceName).join(', ');
  const serviceDescriptions = data.services.map(s => s.serviceDescription).filter(Boolean).join('; ');
  const repairTimes = data.services.map(s => s.repairTime).filter(Boolean).join(', ');
  const warranties = data.services.map(s => s.warranty).filter(Boolean).join(', ');

  const serviceItemTemplate = await storage.getMessageTemplate(serviceItemTemplateKey);
  const servicesList = buildServicesList(data.services, serviceItemTemplate?.content || defaultServiceItemTemplate);

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

  return cleanupPlaceholders(result, mode);
}
